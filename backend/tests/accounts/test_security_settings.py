from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

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
