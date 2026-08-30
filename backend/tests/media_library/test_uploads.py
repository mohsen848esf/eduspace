from unittest.mock import patch

from django.core.exceptions import PermissionDenied, ValidationError
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from media_library.models import MediaAsset, MediaUploadSession
from media_library.services import MediaUploadService


class FakeMultipartStorage:
    def __init__(self, actual_size=None, uploaded_parts=None):
        self.actual_size = actual_size
        self.uploaded_parts = uploaded_parts or []
        self.aborted = []
        self.deleted = []

    def initiate(self, *, object_key, content_type):
        del object_key, content_type
        return 'provider-upload-id'

    def sign_part(self, *, object_key, provider_upload_id, part_number):
        del object_key, provider_upload_id
        return f'https://storage.test/part/{part_number}'

    def complete(self, *, object_key, provider_upload_id, parts):
        del object_key, provider_upload_id, parts
        return self.actual_size

    def list_parts(self, *, object_key, provider_upload_id):
        del object_key, provider_upload_id
        return self.uploaded_parts

    def abort(self, *, object_key, provider_upload_id):
        self.aborted.append((object_key, provider_upload_id))

    def delete(self, *, object_key):
        self.deleted.append(object_key)


@override_settings(
    MEDIA_UPLOAD_MAX_SIZE_BYTES=10 * 1024**3,
    MEDIA_UPLOAD_PART_SIZE_BYTES=8 * 1024**2,
    MEDIA_UPLOAD_SESSION_TTL_SECONDS=86_400,
    MEDIA_UPLOAD_URL_TTL_SECONDS=900,
)
class MediaUploadServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='upload-owner')
        self.other = User.objects.create_user(username='upload-other')
        self.asset = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Large film',
            original_filename='large-film.mp4',
        )

    def initiate(self, storage=None):
        return MediaUploadService.initiate(
            asset=self.asset,
            actor=self.owner,
            size_bytes=100_000_000,
            content_type='video/mp4',
            storage=storage or FakeMultipartStorage(),
        )

    def test_initiate_creates_direct_multipart_session_without_storing_file_in_django(self):
        upload = self.initiate()
        self.asset.refresh_from_db()
        self.assertEqual(upload.expected_size_bytes, 100_000_000)
        self.assertEqual(upload.status, MediaUploadSession.Status.INITIATED)
        self.assertEqual(self.asset.size_bytes, 100_000_000)
        self.assertFalse(bool(self.asset.source_file))

    def test_declared_mime_must_match_allowed_extension_and_owner(self):
        with self.assertRaises(ValidationError):
            MediaUploadService.initiate(
                asset=self.asset, actor=self.owner, size_bytes=1_000,
                content_type='text/html', storage=FakeMultipartStorage(),
            )
        with self.assertRaises(PermissionDenied):
            MediaUploadService.initiate(
                asset=self.asset, actor=self.other, size_bytes=1_000,
                content_type='video/mp4', storage=FakeMultipartStorage(),
            )

    def test_part_number_is_bounded_to_declared_size(self):
        upload = self.initiate()
        url = MediaUploadService.sign_part(
            session=upload, actor=self.owner, part_number=1,
            storage=FakeMultipartStorage(),
        )
        self.assertEqual(url, 'https://storage.test/part/1')
        with self.assertRaises(ValidationError):
            MediaUploadService.sign_part(
                session=upload, actor=self.owner, part_number=100,
                storage=FakeMultipartStorage(),
            )

    def test_resume_state_recovers_uploaded_parts_from_object_storage(self):
        upload = self.initiate()
        parts = [{'part_number': 1, 'etag': 'etag-1', 'size_bytes': 8 * 1024**2}]
        upload, recovered = MediaUploadService.resume_state(
            session=upload,
            actor=self.owner,
            storage=FakeMultipartStorage(uploaded_parts=parts),
        )
        self.assertEqual(recovered, parts)
        self.assertEqual(upload.uploaded_bytes, 8 * 1024**2)
        self.assertEqual(upload.status, MediaUploadSession.Status.UPLOADING)

    def test_complete_verifies_object_size_before_queueing_inspection(self):
        upload = self.initiate()
        with patch('media_library.tasks.inspect_media_asset_task.delay') as delay:
            with self.captureOnCommitCallbacks(execute=True):
                completed = MediaUploadService.complete(
                    session=upload,
                    actor=self.owner,
                    parts=[{'PartNumber': 1, 'ETag': 'etag-1'}],
                    storage=FakeMultipartStorage(actual_size=100_000_000),
                )
        self.asset.refresh_from_db()
        self.assertEqual(completed.status, MediaUploadSession.Status.COMPLETED)
        self.assertEqual(self.asset.status, MediaAsset.Status.INSPECTING)
        delay.assert_called_once_with(self.asset.id)

    def test_size_mismatch_deletes_untrusted_object_and_marks_upload_failed(self):
        upload = self.initiate()
        storage = FakeMultipartStorage(actual_size=99)
        with self.assertRaises(ValidationError):
            MediaUploadService.complete(
                session=upload,
                actor=self.owner,
                parts=[{'PartNumber': 1, 'ETag': 'etag-1'}],
                storage=storage,
            )
        upload.refresh_from_db()
        self.assertEqual(upload.status, MediaUploadSession.Status.FAILED)
        self.assertEqual(storage.deleted, [upload.object_key])


@override_settings(
    S3_ENABLED=False,
    MEDIA_UPLOAD_MAX_SIZE_BYTES=10 * 1024**3,
    MEDIA_UPLOAD_PART_SIZE_BYTES=8 * 1024**2,
    MEDIA_UPLOAD_SESSION_TTL_SECONDS=86_400,
    MEDIA_UPLOAD_URL_TTL_SECONDS=900,
)
class MediaUploadApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='api-upload-owner')
        self.asset = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='API film',
            original_filename='api-film.mp4',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_unconfigured_storage_fails_closed(self):
        response = self.client.post(
            reverse('media_upload_initiate', kwargs={'public_token': self.asset.public_token}),
            {'size_bytes': 10_000_000, 'content_type': 'video/mp4'},
            format='json',
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'STORAGE_NOT_CONFIGURED')
        self.assertFalse(MediaUploadSession.objects.exists())

    @patch('media_library.services.uploads.S3MultipartUploadStorage')
    def test_initiate_returns_resumable_upload_contract(self, storage_class):
        storage_class.return_value = FakeMultipartStorage()
        response = self.client.post(
            reverse('media_upload_initiate', kwargs={'public_token': self.asset.public_token}),
            {'size_bytes': 20_000_000, 'content_type': 'video/mp4'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['data']['part_size_bytes'], 8 * 1024**2)
        self.assertEqual(response.data['data']['part_count'], 3)
