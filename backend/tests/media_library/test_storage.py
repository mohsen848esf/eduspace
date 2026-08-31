from unittest.mock import MagicMock, patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from media_library.storage import S3MultipartUploadStorage


def _distinct_clients(mock_client):
    """boto3.client() returns one shared MagicMock by default; give each
    call (signing client, then internal client) its own so tests can
    distinguish which one a method actually used."""
    mock_client.side_effect = lambda *args, **kwargs: MagicMock()


@override_settings(
    S3_ENABLED=True,
    AWS_STORAGE_BUCKET_NAME='eduspace-media',
    AWS_ACCESS_KEY_ID='key',
    AWS_SECRET_ACCESS_KEY='secret',
    AWS_S3_ENDPOINT_URL='https://app.example.com',
    AWS_S3_INTERNAL_ENDPOINT_URL=None,
    AWS_S3_REGION_NAME='us-east-1',
    AWS_S3_ADDRESSING_STYLE='path',
)
class S3MultipartUploadStorageClientSelectionTests(SimpleTestCase):
    @patch('media_library.storage.boto3.client')
    def test_falls_back_to_public_endpoint_when_no_internal_endpoint_configured(self, mock_client):
        S3MultipartUploadStorage()
        endpoints = [call.kwargs['endpoint_url'] for call in mock_client.call_args_list]
        self.assertEqual(endpoints, ['https://app.example.com', 'https://app.example.com'])

    @override_settings(AWS_S3_INTERNAL_ENDPOINT_URL='http://minio:9000')
    @patch('media_library.storage.boto3.client')
    def test_uses_internal_endpoint_for_server_side_client_when_configured(self, mock_client):
        S3MultipartUploadStorage()
        endpoints = [call.kwargs['endpoint_url'] for call in mock_client.call_args_list]
        self.assertIn('https://app.example.com', endpoints)
        self.assertIn('http://minio:9000', endpoints)

    @override_settings(AWS_S3_INTERNAL_ENDPOINT_URL='http://minio:9000')
    @patch('media_library.storage.boto3.client')
    def test_presigned_url_methods_always_sign_against_the_public_endpoint(self, mock_client):
        _distinct_clients(mock_client)
        storage = S3MultipartUploadStorage()
        self.assertIsNot(storage.client, storage._signing_client)

        storage.sign_part(object_key='k', provider_upload_id='u', part_number=1)
        storage.sign_put_object(object_key='k')
        storage.sign_download(object_key='k')

        storage._signing_client.generate_presigned_url.assert_called()
        storage.client.generate_presigned_url.assert_not_called()

    @override_settings(AWS_S3_INTERNAL_ENDPOINT_URL='http://minio:9000')
    @patch('media_library.storage.boto3.client')
    def test_direct_calls_use_the_internal_client(self, mock_client):
        _distinct_clients(mock_client)
        storage = S3MultipartUploadStorage()
        storage.head(object_key='k')
        storage.client.head_object.assert_called_once()
        storage._signing_client.head_object.assert_not_called()

    @override_settings(S3_ENABLED=False)
    def test_raises_when_storage_is_not_configured(self):
        with self.assertRaises(ImproperlyConfigured):
            S3MultipartUploadStorage()
