import io
import os
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath

import requests
import olefile
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject

from rooms.models import PresentationDocument, Room


OFFICE_SOURCE_TYPES = {
    PresentationDocument.SourceType.PPT,
    PresentationDocument.SourceType.PPTX,
    PresentationDocument.SourceType.ODP,
    PresentationDocument.SourceType.DOC,
    PresentationDocument.SourceType.DOCX,
}

EXTENSION_SOURCE_TYPES = {
    '.pdf': PresentationDocument.SourceType.PDF,
    '.png': PresentationDocument.SourceType.PNG,
    '.jpg': PresentationDocument.SourceType.JPEG,
    '.jpeg': PresentationDocument.SourceType.JPEG,
    '.webp': PresentationDocument.SourceType.WEBP,
    '.ppt': PresentationDocument.SourceType.PPT,
    '.pptx': PresentationDocument.SourceType.PPTX,
    '.odp': PresentationDocument.SourceType.ODP,
    '.doc': PresentationDocument.SourceType.DOC,
    '.docx': PresentationDocument.SourceType.DOCX,
}

EXPECTED_CONTENT_TYPES = {
    PresentationDocument.SourceType.PDF: {'application/pdf', 'application/octet-stream'},
    PresentationDocument.SourceType.PNG: {'image/png', 'application/octet-stream'},
    PresentationDocument.SourceType.JPEG: {
        'image/jpeg', 'image/jpg', 'application/octet-stream',
    },
    PresentationDocument.SourceType.WEBP: {'image/webp', 'application/octet-stream'},
    PresentationDocument.SourceType.PPT: {
        'application/vnd.ms-powerpoint', 'application/octet-stream',
    },
    PresentationDocument.SourceType.PPTX: {
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/octet-stream',
    },
    PresentationDocument.SourceType.ODP: {
        'application/vnd.oasis.opendocument.presentation',
        'application/zip',
        'application/octet-stream',
    },
    PresentationDocument.SourceType.DOC: {
        'application/msword', 'application/octet-stream',
    },
    PresentationDocument.SourceType.DOCX: {
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/octet-stream',
    },
}

OLE_SIGNATURE = bytes.fromhex('D0CF11E0A1B11AE1')
UNSAFE_PDF_KEYS = {
    '/AA', '/OpenAction', '/JavaScript', '/JS', '/Launch', '/EmbeddedFiles',
}


class PresentationUploadError(Exception):
    def __init__(self, *, message: str, code: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class TransientConversionError(Exception):
    pass


class PermanentConversionError(Exception):
    pass


@dataclass(frozen=True)
class ValidatedUpload:
    source_type: str
    output: ContentFile | None
    output_name: str | None
    file_type: str
    total_pages: int
    requires_conversion: bool


def _rewind(uploaded_file) -> None:
    uploaded_file.seek(0)


def _read_all(uploaded_file) -> bytes:
    _rewind(uploaded_file)
    data = uploaded_file.read()
    _rewind(uploaded_file)
    return data


def _validate_declared_content_type(uploaded_file, source_type: str) -> None:
    content_type = (getattr(uploaded_file, 'content_type', '') or '').lower()
    if content_type and content_type not in EXPECTED_CONTENT_TYPES[source_type]:
        raise PresentationUploadError(
            message='نوع محتوای فایل با پسوند آن مطابقت ندارد.',
            code='INVALID_FILE_CONTENT',
        )


def _validate_archive_path(name: str) -> None:
    path = PurePosixPath(name.replace('\\', '/'))
    if path.is_absolute() or '..' in path.parts:
        raise PresentationUploadError(
            message='ساختار داخلی فایل معتبر نیست.',
            code='INVALID_FILE_CONTENT',
        )


def _validate_zip_container(data: bytes, source_type: str) -> None:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 2000:
                raise PresentationUploadError(
                    message='ساختار فایل بیش از حد پیچیده است.',
                    code='DOCUMENT_TOO_COMPLEX',
                )

            total_uncompressed = 0
            names = set()
            for entry in entries:
                _validate_archive_path(entry.filename)
                names.add(entry.filename)
                total_uncompressed += entry.file_size
                if total_uncompressed > settings.PRESENTATION_MAX_OUTPUT_BYTES:
                    raise PresentationUploadError(
                        message='حجم بازشده سند بیش از حد مجاز است.',
                        code='DOCUMENT_TOO_COMPLEX',
                    )
                if entry.file_size and (
                    not entry.compress_size
                    or entry.file_size / entry.compress_size > 100
                ):
                    raise PresentationUploadError(
                        message='نسبت فشرده‌سازی فایل غیرمجاز است.',
                        code='DOCUMENT_TOO_COMPLEX',
                    )

            lowered = {name.lower() for name in names}
            has_macro_content = any(
                'vbaproject.bin' in name
                or 'basic' in PurePosixPath(name.replace('\\', '/')).parts
                for name in lowered
            )
            if has_macro_content:
                raise PresentationUploadError(
                    message='فایل‌های دارای macro پشتیبانی نمی‌شوند.',
                    code='MACRO_ENABLED_DOCUMENT',
                )

            if source_type == PresentationDocument.SourceType.PPTX:
                required = {'[Content_Types].xml', 'ppt/presentation.xml'}
                if not required.issubset(names):
                    raise PresentationUploadError(
                        message='ساختار فایل PowerPoint معتبر نیست.',
                        code='INVALID_FILE_CONTENT',
                    )
            elif source_type == PresentationDocument.SourceType.DOCX:
                required = {'[Content_Types].xml', 'word/document.xml'}
                if not required.issubset(names):
                    raise PresentationUploadError(
                        message='ساختار فایل Word معتبر نیست.',
                        code='INVALID_FILE_CONTENT',
                    )
            elif source_type == PresentationDocument.SourceType.ODP:
                if 'mimetype' not in names:
                    raise PresentationUploadError(
                        message='ساختار فایل ODP معتبر نیست.',
                        code='INVALID_FILE_CONTENT',
                    )
                mimetype = archive.read('mimetype').decode('ascii', errors='ignore').strip()
                if mimetype != 'application/vnd.oasis.opendocument.presentation':
                    raise PresentationUploadError(
                        message='ساختار فایل ODP معتبر نیست.',
                        code='INVALID_FILE_CONTENT',
                    )
    except (zipfile.BadZipFile, OSError) as exc:
        raise PresentationUploadError(
            message='فایل Office خراب یا نامعتبر است.',
            code='INVALID_FILE_CONTENT',
        ) from exc


def _validate_legacy_office(data: bytes, source_type: str) -> None:
    if not data.startswith(OLE_SIGNATURE) or not olefile.isOleFile(io.BytesIO(data)):
        raise PresentationUploadError(
            message='ساختار فایل Office قدیمی معتبر نیست.',
            code='INVALID_FILE_CONTENT',
        )
    try:
        with olefile.OleFileIO(io.BytesIO(data)) as container:
            paths = container.listdir(streams=True, storages=True)
            normalized_parts = {
                part.casefold()
                for path in paths
                for part in path
            }
            if any(
                part == 'macros' or part == 'vba' or 'vba_project' in part
                for part in normalized_parts
            ):
                raise PresentationUploadError(
                    message='فایل‌های دارای macro پشتیبانی نمی‌شوند.',
                    code='MACRO_ENABLED_DOCUMENT',
                )

            if source_type == PresentationDocument.SourceType.PPT:
                has_expected_streams = container.exists('PowerPoint Document')
            else:
                has_expected_streams = (
                    container.exists('WordDocument')
                    and (container.exists('0Table') or container.exists('1Table'))
                )
    except PresentationUploadError:
        raise
    except Exception as exc:
        raise PresentationUploadError(
            message='فایل Office قدیمی خراب یا نامعتبر است.',
            code='INVALID_FILE_CONTENT',
        ) from exc
    if not has_expected_streams:
        raise PresentationUploadError(
            message='محتوای فایل Office با پسوند آن مطابقت ندارد.',
            code='INVALID_FILE_CONTENT',
        )


def _contains_unsafe_pdf_object(value, *, visited: set[int], depth: int = 0) -> bool:
    if depth > 50:
        return True
    if isinstance(value, IndirectObject):
        object_key = (value.idnum << 16) + value.generation
        if object_key in visited:
            return False
        visited.add(object_key)
        try:
            value = value.get_object()
        except Exception:
            return True
    if isinstance(value, DictionaryObject):
        for key, child in value.items():
            if str(key) in UNSAFE_PDF_KEYS:
                return True
            if _contains_unsafe_pdf_object(child, visited=visited, depth=depth + 1):
                return True
    elif isinstance(value, ArrayObject):
        return any(
            _contains_unsafe_pdf_object(child, visited=visited, depth=depth + 1)
            for child in value
        )
    return False


def sanitize_pdf(data: bytes) -> tuple[ContentFile, int]:
    if not data.startswith(b'%PDF-'):
        raise PresentationUploadError(
            message='محتوای فایل PDF معتبر نیست.',
            code='INVALID_FILE_CONTENT',
        )
    try:
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise PresentationUploadError(
                message='PDF رمزگذاری‌شده پشتیبانی نمی‌شود.',
                code='ENCRYPTED_DOCUMENT',
            )
        page_count = len(reader.pages)
        if page_count < 1 or page_count > settings.PRESENTATION_MAX_PAGES:
            raise PresentationUploadError(
                message='تعداد صفحات سند بیش از حد مجاز است.',
                code='DOCUMENT_TOO_COMPLEX',
            )
        if _contains_unsafe_pdf_object(reader.trailer, visited=set()):
            raise PresentationUploadError(
                message='PDF شامل محتوای تعاملی غیرمجاز است.',
                code='INVALID_FILE_CONTENT',
            )

        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
            writer.pages[-1].pop('/Annots', None)
        writer.add_metadata({})
        output = io.BytesIO()
        writer.write(output)
    except PresentationUploadError:
        raise
    except (PdfReadError, OSError, ValueError, TypeError) as exc:
        raise PresentationUploadError(
            message='فایل PDF خراب یا نامعتبر است.',
            code='INVALID_FILE_CONTENT',
        ) from exc

    sanitized = output.getvalue()
    if len(sanitized) > settings.PRESENTATION_MAX_OUTPUT_BYTES:
        raise PresentationUploadError(
            message='حجم خروجی PDF بیش از حد مجاز است.',
            code='DOCUMENT_TOO_COMPLEX',
        )
    return ContentFile(sanitized), page_count


def sanitize_image(data: bytes, source_type: str) -> ContentFile:
    expected_format = {
        PresentationDocument.SourceType.PNG: 'PNG',
        PresentationDocument.SourceType.JPEG: 'JPEG',
        PresentationDocument.SourceType.WEBP: 'WEBP',
    }[source_type]
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format != expected_format:
                raise PresentationUploadError(
                    message='محتوای تصویر با پسوند آن مطابقت ندارد.',
                    code='INVALID_FILE_CONTENT',
                )
            if image.width * image.height > settings.PRESENTATION_MAX_IMAGE_PIXELS:
                raise PresentationUploadError(
                    message='ابعاد تصویر بیش از حد مجاز است.',
                    code='DOCUMENT_TOO_COMPLEX',
                )
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            converted = image.convert('RGB')
            output = io.BytesIO()
            converted.save(output, format='WEBP', quality=82, method=6)
    except PresentationUploadError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise PresentationUploadError(
            message='فایل تصویر خراب یا نامعتبر است.',
            code='INVALID_FILE_CONTENT',
        ) from exc
    return ContentFile(output.getvalue())


def validate_uploaded_presentation(uploaded_file) -> ValidatedUpload:
    if not uploaded_file or uploaded_file.size <= 0:
        raise PresentationUploadError(
            message='فایل خالی یا ارسال‌نشده است.',
            code='INVALID_FILE_CONTENT',
        )
    if uploaded_file.size > settings.PRESENTATION_MAX_UPLOAD_BYTES:
        raise PresentationUploadError(
            message='حداکثر حجم مجاز فایل ۵۰ مگابایت است.',
            code='FILE_TOO_LARGE',
        )

    extension = os.path.splitext(os.path.basename(uploaded_file.name))[1].lower()
    source_type = EXTENSION_SOURCE_TYPES.get(extension)
    if not source_type:
        raise PresentationUploadError(
            message='فرمت فایل پشتیبانی نمی‌شود.',
            code='UNSUPPORTED_FILE_TYPE',
        )
    _validate_declared_content_type(uploaded_file, source_type)
    data = _read_all(uploaded_file)

    if source_type == PresentationDocument.SourceType.PDF:
        output, page_count = sanitize_pdf(data)
        return ValidatedUpload(
            source_type=source_type,
            output=output,
            output_name='presentation.pdf',
            file_type=PresentationDocument.FileType.PDF,
            total_pages=page_count,
            requires_conversion=False,
        )
    if source_type in {
        PresentationDocument.SourceType.PNG,
        PresentationDocument.SourceType.JPEG,
        PresentationDocument.SourceType.WEBP,
    }:
        output = sanitize_image(data, source_type)
        return ValidatedUpload(
            source_type=source_type,
            output=output,
            output_name='presentation.webp',
            file_type=PresentationDocument.FileType.IMAGE,
            total_pages=1,
            requires_conversion=False,
        )
    if source_type in {
        PresentationDocument.SourceType.PPTX,
        PresentationDocument.SourceType.DOCX,
        PresentationDocument.SourceType.ODP,
    }:
        _validate_zip_container(data, source_type)
    else:
        _validate_legacy_office(data, source_type)

    return ValidatedUpload(
        source_type=source_type,
        output=None,
        output_name=None,
        file_type=PresentationDocument.FileType.SLIDE,
        total_pages=1,
        requires_conversion=True,
    )


class PresentationUploadService:
    @staticmethod
    @transaction.atomic
    def create_document(
        *, room: Room, uploaded_file, title: str, uploader, guest_uploader_name: str | None,
    ) -> tuple[PresentationDocument, bool]:
        validated = validate_uploaded_presentation(uploaded_file)
        safe_title = (title or os.path.basename(uploaded_file.name)).strip()[:255]
        if not safe_title:
            safe_title = 'Presentation'

        document = PresentationDocument(
            room=room,
            uploader=uploader,
            guest_uploader_name=guest_uploader_name if not uploader else None,
            title=safe_title,
            source_type=validated.source_type,
            original_filename=os.path.basename(uploaded_file.name)[:255],
            file_type=validated.file_type,
            file_size_bytes=uploaded_file.size,
            total_pages=validated.total_pages,
            current_page=1,
            processing_status=(
                PresentationDocument.ProcessingStatus.PENDING
                if validated.requires_conversion
                else PresentationDocument.ProcessingStatus.READY
            ),
            processing_completed_at=None if validated.requires_conversion else timezone.now(),
        )
        document.save()
        try:
            if validated.requires_conversion:
                _rewind(uploaded_file)
                document.source_file.save(uploaded_file.name, uploaded_file, save=True)
            elif validated.output and validated.output_name:
                document.file.save(validated.output_name, validated.output, save=True)
                document.file_size_bytes = document.file.size
                document.save(update_fields=['file_size_bytes'])
        except Exception:
            if document.file:
                document.file.delete(save=False)
            if document.source_file:
                document.source_file.delete(save=False)
            raise
        return document, validated.requires_conversion


class GotenbergConversionService:
    @staticmethod
    def convert(document: PresentationDocument) -> None:
        if not document.source_file:
            raise PermanentConversionError('SOURCE_FILE_MISSING')

        document.processing_status = PresentationDocument.ProcessingStatus.PROCESSING
        document.processing_started_at = timezone.now()
        document.processing_error_code = ''
        document.save(update_fields=[
            'processing_status', 'processing_started_at', 'processing_error_code',
        ])

        converted_pdf = bytearray()
        try:
            with document.source_file.open('rb') as source:
                response_context = requests.post(
                    f'{settings.GOTENBERG_URL}/forms/libreoffice/convert',
                    files={'files': (f'presentation.{document.source_type}', source)},
                    data={
                        'exportFormFields': 'false',
                        'updateIndexes': 'false',
                        'skipEmptyPages': 'true',
                        'reduceImageResolution': 'true',
                        'maxImageResolution': '300',
                        'quality': '85',
                    },
                    timeout=settings.PRESENTATION_CONVERSION_TIMEOUT_SECONDS,
                    stream=True,
                )
                with response_context as response:
                    response_status = response.status_code
                    if response_status == 200:
                        for chunk in response.iter_content(chunk_size=64 * 1024):
                            if not chunk:
                                continue
                            converted_pdf.extend(chunk)
                            if len(converted_pdf) > settings.PRESENTATION_MAX_OUTPUT_BYTES:
                                raise PermanentConversionError('DOCUMENT_TOO_COMPLEX')
        except (requests.Timeout, requests.ConnectionError) as exc:
            raise TransientConversionError('CONVERSION_TIMEOUT') from exc
        except OSError as exc:
            raise PermanentConversionError('SOURCE_FILE_MISSING') from exc

        if response_status == 400:
            raise PermanentConversionError('INVALID_FILE_CONTENT')
        if response_status >= 500:
            raise TransientConversionError('CONVERSION_FAILED')
        if response_status != 200:
            raise PermanentConversionError('CONVERSION_FAILED')

        try:
            sanitized_pdf, page_count = sanitize_pdf(bytes(converted_pdf))
        except PresentationUploadError as exc:
            raise PermanentConversionError(exc.code) from exc

        old_file_name = document.file.name if document.file else None
        document.file.save('presentation.pdf', sanitized_pdf, save=False)
        document.file_type = PresentationDocument.FileType.PDF
        document.file_size_bytes = document.file.size
        document.total_pages = page_count
        document.current_page = 1
        document.processing_status = PresentationDocument.ProcessingStatus.READY
        document.processing_error_code = ''
        document.processing_completed_at = timezone.now()
        document.save(update_fields=[
            'file', 'file_type', 'file_size_bytes', 'total_pages', 'current_page',
            'processing_status', 'processing_error_code', 'processing_completed_at',
        ])
        if old_file_name and old_file_name != document.file.name:
            document.file.storage.delete(old_file_name)
        document.source_file.delete(save=False)
        document.source_file = None
        document.save(update_fields=['source_file'])
