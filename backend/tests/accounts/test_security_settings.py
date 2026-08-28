from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase
from django.test import RequestFactory
from unittest.mock import patch

from config.security import MIN_SIGNING_SECRET_BYTES, validate_signing_secret


class SigningSecretValidationTests(SimpleTestCase):
    def test_livekit_secret_meets_hs256_minimum(self):
        self.assertGreaterEqual(
            len(settings.LIVEKIT_API_SECRET.encode('utf-8')),
            MIN_SIGNING_SECRET_BYTES,
        )

    def test_short_signing_secret_is_rejected(self):
        with self.assertRaisesMessage(ImproperlyConfigured, 'LIVEKIT_API_SECRET'):
            validate_signing_secret(
                'x' * (MIN_SIGNING_SECRET_BYTES - 1),
                setting_name='LIVEKIT_API_SECRET',
            )


    def test_minimum_length_signing_secret_is_accepted(self):
        secret = 'x' * MIN_SIGNING_SECRET_BYTES

        self.assertEqual(
            validate_signing_secret(secret, setting_name='LIVEKIT_API_SECRET'),
            secret,
        )

    def test_forbidden_development_secret_is_rejected(self):
        secret = 'development-secret-that-is-long-enough'

        with self.assertRaisesMessage(ImproperlyConfigured, 'local development default'):
            validate_signing_secret(
                secret,
                setting_name='LIVEKIT_API_SECRET',
                forbidden_values=(secret,),
            )


class ServerProbeTests(SimpleTestCase):
    def test_liveness_does_not_require_database(self):
        from config.server_urls import healthz
        response = healthz(RequestFactory().get('/healthz/'))
        self.assertEqual(response.status_code, 200)

    def test_readiness_failure_does_not_expose_connection_details(self):
        from config.server_urls import readyz
        with patch('config.server_urls.connection') as database:
            database.cursor.side_effect = RuntimeError('password=private-secret')
            response = readyz(RequestFactory().get('/readyz/'))
        self.assertEqual(response.status_code, 503)
        self.assertNotIn(b'private-secret', response.content)

    def test_readiness_checks_cache_and_database(self):
        from config.server_urls import readyz
        with patch('config.server_urls.connection') as database, patch('config.server_urls.cache') as cache:
            response = readyz(RequestFactory().get('/readyz/'))
        self.assertEqual(response.status_code, 200)
        database.cursor.return_value.__enter__.return_value.execute.assert_called_once_with('SELECT 1')
        cache.get.assert_called_once_with('eduspace-readiness')
