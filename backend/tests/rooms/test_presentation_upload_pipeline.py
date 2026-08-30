import io
import tempfile
import zipfile
from unittest.mock import MagicMock, patch

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image
from pypdf import PdfReader, PdfWriter
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from rooms.models import PresentationDocument, Room, RoomParticipant
from rooms.services.presentation_upload import (
    GotenbergConversionService,
    PermanentConversionError,
    PresentationUploadError,
    PresentationUploadService,
    validate_uploaded_presentation,
)
from rooms.tasks import convert_presentation_document_task


def make_pdf(*, pages=2, active_content=False, link_annotation=False):
    output = io.BytesIO()
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=612, height=792)
    if active_content:
        writer.add_js("app.alert('unsafe')")
    if link_annotation:
        writer.add_uri(0, 'https://example.com', (10, 10, 100, 30))
    writer.write(output)
    return output.getvalue()


def make_encrypted_pdf():
    output = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.encrypt('secret')
    writer.write(output)
    return output.getvalue()


def make_image(format_name='PNG'):
    output = io.BytesIO()
    Image.new('RGB', (32, 24), color=(30, 90, 160)).save(output, format=format_name)
    return output.getvalue()


def make_office_zip(source_type, *, macro=False, bomb=False):
    output = io.BytesIO()
    compression = zipfile.ZIP_DEFLATED
    with zipfile.ZipFile(output, 'w', compression=compression) as archive:
        if source_type == 'pptx':
            archive.writestr('[Content_Types].xml', '<Types/>')
            archive.writestr('ppt/presentation.xml', '<p:presentation/>')
        elif source_type == 'docx':
            archive.writestr('[Content_Types].xml', '<Types/>')
            archive.writestr('word/document.xml', '<w:document/>')
        elif source_type == 'odp':
            archive.writestr('mimetype', 'application/vnd.oasis.opendocument.presentation')
            archive.writestr('content.xml', '<office:presentation/>')
        if macro:
            archive.writestr('ppt/vbaProject.bin', b'macro')
        if bomb:
            archive.writestr('ppt/media/bomb.bin', b'0' * 1_000_000)
    return output.getvalue()


@override_settings(
    PRESENTATION_MAX_UPLOAD_BYTES=50 * 1024 * 1024,
    PRESENTATION_MAX_OUTPUT_BYTES=100 * 1024 * 1024,
    PRESENTATION_MAX_PAGES=300,
    PRESENTATION_MAX_IMAGE_PIXELS=40_000_000,
)
class PresentationUploadPipelineTests(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.output_storage = FileSystemStorage(location=f'{self.temp_dir.name}/public')
        self.source_storage = FileSystemStorage(location=f'{self.temp_dir.name}/private')
        self.file_field = PresentationDocument._meta.get_field('file')
        self.source_field = PresentationDocument._meta.get_field('source_file')
        self.original_file_storage = self.file_field.storage
        self.original_source_storage = self.source_field.storage
        self.file_field.storage = self.output_storage
        self.source_field.storage = self.source_storage

        self.client = APIClient()
        self.host = User.objects.create_user(username='pipeline_host', password='Password123!')
        self.room = Room.objects.create(
            name='Pipeline Room', room_code='PIP123', host=self.host,
        )
        RoomParticipant.objects.create(
            room=self.room,
            user=self.host,
            role=RoomParticipant.Role.HOST,
            can_upload_presentation=True,
        )
        self.client.force_authenticate(user=self.host)

    def tearDown(self):
        PresentationDocument.objects.all().delete()
        self.file_field.storage = self.original_file_storage
        self.source_field.storage = self.original_source_storage
        self.temp_dir.cleanup()

    def upload_url(self):
        return reverse('upload_presentation', kwargs={'room_code': self.room.room_code})

    def test_pdf_is_rewritten_and_page_count_is_server_owned(self):
        response = self.client.post(
            self.upload_url(),
            {
                'file': SimpleUploadedFile('deck.pdf', make_pdf(pages=3), 'application/pdf'),
                'title': 'Safe deck',
                'total_pages': 999,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['processing_status'], 'ready')
        self.assertEqual(response.data['total_pages'], 3)
        document = PresentationDocument.objects.get(pk=response.data['id'])
        self.assertTrue(document.file.name.endswith('.pdf'))
        self.assertNotIn('deck.pdf', document.file.name)

    def test_image_is_decoded_and_reencoded_as_webp(self):
        response = self.client.post(
            self.upload_url(),
            {'file': SimpleUploadedFile('photo.png', make_image(), 'image/png')},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        document = PresentationDocument.objects.get(pk=response.data['id'])
        self.assertEqual(document.source_type, 'png')
        self.assertTrue(document.file.name.endswith('.webp'))
        with document.file.open('rb') as output:
            self.assertEqual(output.read(4), b'RIFF')

    def test_fake_pdf_and_active_pdf_are_rejected(self):
        fake = self.client.post(
            self.upload_url(),
            {'file': SimpleUploadedFile('fake.pdf', b'not a pdf', 'application/pdf')},
            format='multipart',
        )
        self.assertEqual(fake.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(fake.data['code'], 'INVALID_FILE_CONTENT')

        active = self.client.post(
            self.upload_url(),
            {
                'file': SimpleUploadedFile(
                    'active.pdf', make_pdf(active_content=True), 'application/pdf',
                ),
            },
            format='multipart',
        )
        self.assertEqual(active.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(active.data['code'], 'INVALID_FILE_CONTENT')

    def test_pdf_annotations_are_removed_from_static_output(self):
        validated = validate_uploaded_presentation(SimpleUploadedFile(
            'linked.pdf',
            make_pdf(pages=1, link_annotation=True),
            'application/pdf',
        ))

        output_reader = PdfReader(validated.output)
        self.assertNotIn('/Annots', output_reader.pages[0])

    def test_unsupported_svg_and_content_type_mismatch_are_rejected(self):
        svg = self.client.post(
            self.upload_url(),
            {'file': SimpleUploadedFile('image.svg', b'<svg/>', 'image/svg+xml')},
            format='multipart',
        )
        self.assertEqual(svg.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(svg.data['code'], 'UNSUPPORTED_FILE_TYPE')

        mismatch = self.client.post(
            self.upload_url(),
            {'file': SimpleUploadedFile('image.png', make_image(), 'application/pdf')},
            format='multipart',
        )
        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(mismatch.data['code'], 'INVALID_FILE_CONTENT')

    def test_office_upload_is_private_pending_and_queued(self):
        with patch('rooms.views.convert_presentation_document_task.delay') as delay:
            response = self.client.post(
                self.upload_url(),
                {
                    'file': SimpleUploadedFile(
                        '../../lesson.pptx',
                        make_office_zip('pptx'),
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    ),
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['processing_status'], 'pending')
        self.assertEqual(response.data['file_url'], '')
        document = PresentationDocument.objects.get(pk=response.data['id'])
        self.assertTrue(document.source_file)
        self.assertNotIn('lesson.pptx', document.source_file.name)
        delay.assert_called_once_with(document.pk)

    def test_macro_and_zip_bomb_are_rejected(self):
        with self.assertRaises(PresentationUploadError) as macro_error:
            validate_uploaded_presentation(SimpleUploadedFile(
                'macro.pptx', make_office_zip('pptx', macro=True),
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ))
        self.assertEqual(macro_error.exception.code, 'MACRO_ENABLED_DOCUMENT')

        with self.assertRaises(PresentationUploadError) as bomb_error:
            validate_uploaded_presentation(SimpleUploadedFile(
                'bomb.pptx', make_office_zip('pptx', bomb=True),
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ))
        self.assertEqual(bomb_error.exception.code, 'DOCUMENT_TOO_COMPLEX')

        odp_with_basic = make_office_zip('odp')
        odp_buffer = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(odp_with_basic)) as source_archive:
            with zipfile.ZipFile(odp_buffer, 'w', zipfile.ZIP_DEFLATED) as output_archive:
                for entry in source_archive.infolist():
                    output_archive.writestr(entry.filename, source_archive.read(entry.filename))
                output_archive.writestr('Basic/Standard/Module1.xml', '<script/>')
        with self.assertRaises(PresentationUploadError) as odp_macro_error:
            validate_uploaded_presentation(SimpleUploadedFile(
                'macro.odp',
                odp_buffer.getvalue(),
                'application/vnd.oasis.opendocument.presentation',
            ))
        self.assertEqual(odp_macro_error.exception.code, 'MACRO_ENABLED_DOCUMENT')

    def test_all_zip_office_formats_are_accepted_for_private_conversion(self):
        content_types = {
            'pptx': (
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ),
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'odp': 'application/vnd.oasis.opendocument.presentation',
        }
        for source_type, content_type in content_types.items():
            with self.subTest(source_type=source_type):
                validated = validate_uploaded_presentation(SimpleUploadedFile(
                    f'lesson.{source_type}',
                    make_office_zip(source_type),
                    content_type,
                ))
                self.assertEqual(validated.source_type, source_type)
                self.assertTrue(validated.requires_conversion)

    def test_legacy_office_formats_require_expected_ole_streams(self):
        cases = {
            'ppt': (
                'application/vnd.ms-powerpoint',
                {'PowerPoint Document'},
            ),
            'doc': (
                'application/msword',
                {'WordDocument', '1Table'},
            ),
        }
        for source_type, (content_type, streams) in cases.items():
            with self.subTest(source_type=source_type):
                container = MagicMock()
                container.__enter__.return_value = container
                container.listdir.return_value = [[stream] for stream in streams]
                container.exists.side_effect = lambda name, known=streams: name in known
                with (
                    patch(
                        'rooms.services.presentation_upload.olefile.isOleFile',
                        return_value=True,
                    ),
                    patch(
                        'rooms.services.presentation_upload.olefile.OleFileIO',
                        return_value=container,
                    ),
                ):
                    validated = validate_uploaded_presentation(SimpleUploadedFile(
                        f'legacy.{source_type}',
                        bytes.fromhex('D0CF11E0A1B11AE1') + b'legacy-office',
                        content_type,
                    ))
                self.assertEqual(validated.source_type, source_type)
                self.assertTrue(validated.requires_conversion)

    def test_legacy_office_macro_storage_is_rejected(self):
        container = MagicMock()
        container.__enter__.return_value = container
        container.listdir.return_value = [['Macros', 'VBA', 'Module1']]
        with (
            patch(
                'rooms.services.presentation_upload.olefile.isOleFile',
                return_value=True,
            ),
            patch(
                'rooms.services.presentation_upload.olefile.OleFileIO',
                return_value=container,
            ),
            self.assertRaises(PresentationUploadError) as macro_error,
        ):
            validate_uploaded_presentation(SimpleUploadedFile(
                'macro.doc',
                bytes.fromhex('D0CF11E0A1B11AE1') + b'legacy-office',
                'application/msword',
            ))
        self.assertEqual(macro_error.exception.code, 'MACRO_ENABLED_DOCUMENT')

    def test_encrypted_pdf_and_oversized_upload_are_rejected(self):
        with self.assertRaises(PresentationUploadError) as encrypted_error:
            validate_uploaded_presentation(SimpleUploadedFile(
                'private.pdf', make_encrypted_pdf(), 'application/pdf',
            ))
        self.assertEqual(encrypted_error.exception.code, 'ENCRYPTED_DOCUMENT')

        with override_settings(PRESENTATION_MAX_UPLOAD_BYTES=3):
            with self.assertRaises(PresentationUploadError) as size_error:
                validate_uploaded_presentation(SimpleUploadedFile(
                    'large.pdf', b'%PDF-too-large', 'application/pdf',
                ))
        self.assertEqual(size_error.exception.code, 'FILE_TOO_LARGE')

    def test_pending_document_cannot_be_presented(self):
        document = PresentationDocument.objects.create(
            room=self.room,
            uploader=self.host,
            title='Pending deck',
            source_type='pptx',
            processing_status=PresentationDocument.ProcessingStatus.PENDING,
        )
        response = self.client.post(
            reverse('set_active_presentation', kwargs={
                'room_code': self.room.room_code,
                'doc_id': document.pk,
            }),
            {'is_active': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'PRESENTATION_NOT_READY')

    def test_failed_document_can_be_retried(self):
        document = PresentationDocument.objects.create(
            room=self.room,
            uploader=self.host,
            title='Failed deck',
            source_type='pptx',
            processing_status=PresentationDocument.ProcessingStatus.FAILED,
        )
        document.source_file.save(
            'failed.pptx',
            SimpleUploadedFile('failed.pptx', make_office_zip('pptx')),
            save=True,
        )
        with patch('rooms.views.convert_presentation_document_task.delay') as delay:
            response = self.client.post(reverse('retry_presentation_conversion', kwargs={
                'room_code': self.room.room_code,
                'doc_id': document.pk,
            }))

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['processing_status'], 'pending')
        delay.assert_called_once_with(document.pk)

    def test_gotenberg_output_is_sanitized_and_source_is_deleted(self):
        uploaded_file = SimpleUploadedFile(
            'lesson.docx',
            make_office_zip('docx'),
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        document, queued = PresentationUploadService.create_document(
            room=self.room,
            uploaded_file=uploaded_file,
            title='Lesson',
            uploader=self.host,
            guest_uploader_name=None,
        )
        self.assertTrue(queued)
        source_name = document.source_file.name
        response = MagicMock(status_code=200)
        response.__enter__.return_value = response
        response.iter_content.return_value = [make_pdf(pages=4)]
        with patch('rooms.services.presentation_upload.requests.post', return_value=response):
            GotenbergConversionService.convert(document)

        document.refresh_from_db()
        self.assertEqual(document.processing_status, 'ready')
        self.assertEqual(document.total_pages, 4)
        self.assertTrue(document.file)
        self.assertFalse(document.source_file)
        self.assertFalse(self.source_storage.exists(source_name))

    def test_gotenberg_stream_is_stopped_at_output_limit(self):
        document = PresentationDocument.objects.create(
            room=self.room,
            uploader=self.host,
            title='Oversized conversion',
            source_type='docx',
            original_filename='lesson.docx',
            processing_status=PresentationDocument.ProcessingStatus.PENDING,
        )
        document.source_file.save(
            'lesson.docx',
            SimpleUploadedFile('lesson.docx', make_office_zip('docx')),
            save=True,
        )
        response = MagicMock(status_code=200)
        response.__enter__.return_value = response
        response.iter_content.return_value = [b'1234']
        with (
            override_settings(PRESENTATION_MAX_OUTPUT_BYTES=3),
            patch(
                'rooms.services.presentation_upload.requests.post',
                return_value=response,
            ),
            self.assertRaises(PermanentConversionError) as conversion_error,
        ):
            GotenbergConversionService.convert(document)

        self.assertEqual(str(conversion_error.exception), 'DOCUMENT_TOO_COMPLEX')

    def test_permanent_task_failure_sets_failed_status(self):
        document = PresentationDocument.objects.create(
            room=self.room,
            uploader=self.host,
            title='Broken deck',
            source_type='pptx',
            processing_status=PresentationDocument.ProcessingStatus.PENDING,
        )
        document.source_file.save(
            'broken.pptx',
            SimpleUploadedFile('broken.pptx', make_office_zip('pptx')),
            save=True,
        )
        response = MagicMock(status_code=400)
        response.__enter__.return_value = response
        with patch('rooms.services.presentation_upload.requests.post', return_value=response):
            result = convert_presentation_document_task.apply(args=[document.pk]).get()

        document.refresh_from_db()
        self.assertIn('rejected', result)
        self.assertEqual(document.processing_status, 'failed')
        self.assertEqual(document.processing_error_code, 'INVALID_FILE_CONTENT')

    def test_duplicate_task_delivery_does_not_convert_processing_document(self):
        document = PresentationDocument.objects.create(
            room=self.room,
            uploader=self.host,
            title='Already processing',
            source_type='pptx',
            processing_status=PresentationDocument.ProcessingStatus.PROCESSING,
        )
        with patch(
            'rooms.tasks.GotenbergConversionService.convert',
        ) as convert:
            result = convert_presentation_document_task.apply(args=[document.pk]).get()

        self.assertIn('not pending', result)
        convert.assert_not_called()

    def test_deleting_document_removes_public_and_private_files(self):
        document = PresentationDocument.objects.create(
            room=self.room,
            uploader=self.host,
            title='Cleanup deck',
            source_type='pptx',
            processing_status=PresentationDocument.ProcessingStatus.FAILED,
        )
        document.file.save(
            'ready.pdf',
            SimpleUploadedFile('ready.pdf', make_pdf()),
            save=False,
        )
        document.source_file.save(
            'source.pptx',
            SimpleUploadedFile('source.pptx', make_office_zip('pptx')),
            save=True,
        )
        output_name = document.file.name
        source_name = document.source_file.name

        with self.captureOnCommitCallbacks(execute=True):
            document.delete()

        self.assertFalse(self.output_storage.exists(output_name))
        self.assertFalse(self.source_storage.exists(source_name))
