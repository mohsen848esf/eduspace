import boto3
import hashlib
import mimetypes
from botocore.config import Config
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class S3MultipartUploadStorage:
    def __init__(self):
        if not settings.S3_ENABLED or not settings.AWS_STORAGE_BUCKET_NAME:
            raise ImproperlyConfigured('S3-compatible object storage is not configured.')
        self.bucket = settings.AWS_STORAGE_BUCKET_NAME
        self.client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
            region_name=settings.AWS_S3_REGION_NAME,
            config=Config(
                signature_version='s3v4',
                s3={'addressing_style': settings.AWS_S3_ADDRESSING_STYLE},
            ),
        )

    def initiate(self, *, object_key: str, content_type: str) -> str:
        response = self.client.create_multipart_upload(
            Bucket=self.bucket,
            Key=object_key,
            ContentType=content_type,
        )
        return response['UploadId']

    def sign_part(self, *, object_key: str, provider_upload_id: str, part_number: int) -> str:
        return self.client.generate_presigned_url(
            'upload_part',
            Params={
                'Bucket': self.bucket,
                'Key': object_key,
                'UploadId': provider_upload_id,
                'PartNumber': part_number,
            },
            ExpiresIn=settings.MEDIA_UPLOAD_URL_TTL_SECONDS,
        )

    def sign_put_object(self, *, object_key: str) -> str:
        return self.client.generate_presigned_url(
            'put_object',
            Params={'Bucket': self.bucket, 'Key': object_key},
            ExpiresIn=settings.MEDIA_UPLOAD_URL_TTL_SECONDS,
        )

    def head(self, *, object_key: str) -> dict:
        response = self.client.head_object(Bucket=self.bucket, Key=object_key)
        return {
            'size_bytes': response['ContentLength'],
            'etag': response.get('ETag', '').strip('"'),
        }

    def read_prefix(self, *, object_key: str, max_bytes: int) -> bytes:
        response = self.client.get_object(
            Bucket=self.bucket,
            Key=object_key,
            Range=f'bytes=0-{max_bytes - 1}',
        )
        return response['Body'].read(max_bytes)

    def stream_sha256(self, *, object_key: str) -> str:
        response = self.client.get_object(Bucket=self.bucket, Key=object_key)
        digest = hashlib.sha256()
        for chunk in iter(lambda: response['Body'].read(4 * 1024 * 1024), b''):
            digest.update(chunk)
        return digest.hexdigest()

    def iter_bytes(self, *, object_key: str, chunk_size: int = 1024 * 1024):
        response = self.client.get_object(Bucket=self.bucket, Key=object_key)
        body = response['Body']
        try:
            while True:
                payload = body.read(chunk_size)
                if not payload:
                    break
                yield payload
        finally:
            body.close()

    def compose_objects(self, *, source_keys: list[str], target_key: str, content_type: str) -> int:
        upload_id = self.initiate(object_key=target_key, content_type=content_type)
        parts = []
        try:
            for number, source_key in enumerate(source_keys, start=1):
                response = self.client.upload_part_copy(
                    Bucket=self.bucket,
                    Key=target_key,
                    UploadId=upload_id,
                    PartNumber=number,
                    CopySource={'Bucket': self.bucket, 'Key': source_key},
                )
                parts.append({
                    'PartNumber': number,
                    'ETag': response['CopyPartResult']['ETag'],
                })
            return self.complete(
                object_key=target_key,
                provider_upload_id=upload_id,
                parts=parts,
            )
        except Exception:
            self.abort(object_key=target_key, provider_upload_id=upload_id)
            raise

    def complete(self, *, object_key: str, provider_upload_id: str, parts: list[dict]) -> int:
        self.client.complete_multipart_upload(
            Bucket=self.bucket,
            Key=object_key,
            UploadId=provider_upload_id,
            MultipartUpload={'Parts': parts},
        )
        return self.client.head_object(Bucket=self.bucket, Key=object_key)['ContentLength']

    def list_parts(self, *, object_key: str, provider_upload_id: str) -> list[dict]:
        parts = []
        paginator = self.client.get_paginator('list_parts')
        for page in paginator.paginate(
            Bucket=self.bucket,
            Key=object_key,
            UploadId=provider_upload_id,
        ):
            parts.extend({
                'part_number': part['PartNumber'],
                'etag': part['ETag'],
                'size_bytes': part['Size'],
            } for part in page.get('Parts', []))
        return parts

    def abort(self, *, object_key: str, provider_upload_id: str) -> None:
        self.client.abort_multipart_upload(
            Bucket=self.bucket,
            Key=object_key,
            UploadId=provider_upload_id,
        )

    def delete(self, *, object_key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=object_key)

    def download(self, *, object_key: str, destination) -> None:
        self.client.download_file(self.bucket, object_key, str(destination))

    def upload_file(self, *, source, object_key: str) -> None:
        content_type = mimetypes.guess_type(str(source))[0] or 'application/octet-stream'
        self.client.upload_file(
            str(source),
            self.bucket,
            object_key,
            ExtraArgs={
                'ContentType': content_type,
                'CacheControl': 'public, max-age=31536000, immutable',
            },
        )

    def upload_tree(self, *, source_root, object_prefix: str) -> None:
        for source in sorted(source_root.rglob('*')):
            if source.is_file():
                relative = source.relative_to(source_root).as_posix()
                self.upload_file(source=source, object_key=f'{object_prefix}/{relative}')

    def delete_prefix(self, *, object_prefix: str) -> None:
        paginator = self.client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=self.bucket, Prefix=f'{object_prefix.rstrip("/")}/'):
            keys = [{'Key': row['Key']} for row in page.get('Contents', [])]
            if keys:
                self.client.delete_objects(
                    Bucket=self.bucket,
                    Delete={'Objects': keys, 'Quiet': True},
                )

    def read_text(self, *, object_key: str, max_bytes: int = 1_000_000) -> str:
        response = self.client.get_object(Bucket=self.bucket, Key=object_key)
        payload = response['Body'].read(max_bytes + 1)
        if len(payload) > max_bytes:
            raise ValueError('Object exceeds the manifest size limit.')
        return payload.decode('utf-8')

    def sign_download(self, *, object_key: str) -> str:
        return self.client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': object_key},
            ExpiresIn=settings.MEDIA_PLAYBACK_OBJECT_URL_TTL_SECONDS,
        )
