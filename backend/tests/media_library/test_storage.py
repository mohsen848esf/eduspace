from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from media_library.storage import S3MultipartUploadStorage


@override_settings(
    S3_ENABLED=True,
    AWS_ACCESS_KEY_ID='key',
    AWS_SECRET_ACCESS_KEY='secret',
    AWS_STORAGE_BUCKET_NAME='test-bucket',
    AWS_S3_ENDPOINT_URL='https://storage.test',
    AWS_S3_REGION_NAME='us-east-1',
    AWS_S3_ADDRESSING_STYLE='path',
)
class DeletePrefixTests(SimpleTestCase):
    def _storage_with_fake_client(self, *, pages, delete_objects_response=None):
        fake_client = MagicMock()
        fake_paginator = MagicMock()
        fake_paginator.paginate.return_value = pages
        fake_client.get_paginator.return_value = fake_paginator
        fake_client.delete_objects.return_value = delete_objects_response or {}
        with patch('media_library.storage.boto3.client', return_value=fake_client):
            storage = S3MultipartUploadStorage()
        return storage, fake_client

    def test_deletes_every_key_under_the_prefix_across_pages(self):
        storage, fake_client = self._storage_with_fake_client(pages=[
            {'Contents': [{'Key': 'media-library/1/hls/tok/abc/source/index.m3u8'}]},
            {'Contents': [{'Key': 'media-library/1/hls/tok/abc/source/seg-0.m4s'}]},
        ])

        storage.delete_prefix(object_prefix='media-library/1/hls/tok')

        fake_client.get_paginator.assert_called_once_with('list_objects_v2')
        fake_client.get_paginator.return_value.paginate.assert_called_once_with(
            Bucket='test-bucket', Prefix='media-library/1/hls/tok/',
        )
        self.assertEqual(fake_client.delete_objects.call_count, 2)

    def test_skips_delete_objects_call_when_a_page_is_empty(self):
        storage, fake_client = self._storage_with_fake_client(pages=[{'Contents': []}])

        storage.delete_prefix(object_prefix='media-library/1/hls/tok')

        fake_client.delete_objects.assert_not_called()

    def test_raises_when_the_provider_reports_partial_delete_failures(self):
        storage, fake_client = self._storage_with_fake_client(
            pages=[{'Contents': [{'Key': 'media-library/1/hls/tok/abc/source/index.m3u8'}]}],
            delete_objects_response={
                'Errors': [{'Key': 'media-library/1/hls/tok/abc/source/index.m3u8', 'Code': 'AccessDenied', 'Message': 'nope'}],
            },
        )

        with self.assertRaises(RuntimeError):
            storage.delete_prefix(object_prefix='media-library/1/hls/tok')
