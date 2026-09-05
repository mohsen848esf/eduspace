from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from media_library.models import MediaAsset, MediaUploadSession, ProgressiveMediaUpload
from media_library.tasks import purge_deleted_media_asset_task


class FakePurgeStorage:
    def __init__(self):
        self.deleted_keys = []
        self.deleted_prefixes = []

    def delete(self, *, object_key):
        self.deleted_keys.append(object_key)

    def delete_prefix(self, *, object_prefix):
        self.deleted_prefixes.append(object_prefix)


class PurgeDeletedMediaAssetTaskTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='purge-owner')
        self.asset = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='To be purged',
            original_filename='clip.mp4',
            is_deleted=True,
            deleted_at=timezone.now(),
        )

    @patch('media_library.storage.S3MultipartUploadStorage')
    def test_purge_deletes_uploads_progressive_chunks_and_hls_prefix(self, storage_cls):
        fake = FakePurgeStorage()
        storage_cls.return_value = fake
        MediaUploadSession.objects.create(
            asset=self.asset,
            status=MediaUploadSession.Status.COMPLETED,
            provider_upload_id='provider-id',
            object_key='media-library/1/source/abc.upload',
            expected_size_bytes=100,
            part_size_bytes=8 * 1024**2,
            content_type='video/mp4',
            expires_at=timezone.now() + timedelta(hours=1),
        )
        ProgressiveMediaUpload.objects.create(
            asset=self.asset,
            expected_size_bytes=100,
            chunk_size_bytes=8 * 1024**2,
            content_type='video/mp4',
            object_prefix='media-library/1/progressive/def',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        result = purge_deleted_media_asset_task(self.asset.pk)

        self.assertIn('purged', result)
        self.assertEqual(fake.deleted_keys, ['media-library/1/source/abc.upload'])
        self.assertIn('media-library/1/progressive/def', fake.deleted_prefixes)
        self.assertIn(
            f'media-library/{self.owner.pk}/hls/{self.asset.public_token}',
            fake.deleted_prefixes,
        )

    @patch('media_library.storage.S3MultipartUploadStorage')
    def test_purge_skips_storage_entirely_when_asset_is_not_deleted(self, storage_cls):
        self.asset.is_deleted = False
        self.asset.save(update_fields=['is_deleted'])

        result = purge_deleted_media_asset_task(self.asset.pk)

        self.assertIn('is not deleted', result)
        storage_cls.assert_not_called()

    def test_purge_is_a_no_op_when_the_asset_no_longer_exists(self):
        result = purge_deleted_media_asset_task(self.asset.pk + 999)
        self.assertIn('no longer exists', result)
