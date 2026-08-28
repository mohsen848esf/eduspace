"""Opt-in server configuration. Local development keeps config.settings."""
import os

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403
from .security import validate_signing_secret

DEPLOY_ENV = os.environ.get('DEPLOY_ENV', '')
if DEPLOY_ENV not in ('staging', 'production'):
    raise ImproperlyConfigured('DEPLOY_ENV must be staging or production.')
if DEBUG:  # noqa: F405
    raise ImproperlyConfigured('Server deployments require DEBUG=False.')
if os.environ.get('USE_SQLITE', 'False').lower() == 'true':
    raise ImproperlyConfigured('Server deployments require PostgreSQL.')
SECRET_KEY = validate_signing_secret(
    os.environ.get('SECRET_KEY', ''), setting_name='SECRET_KEY',
    forbidden_values=('dev-secret-key-change-in-production',),
)
APP_DOMAIN = os.environ.get('APP_DOMAIN', '')
if not APP_DOMAIN or '://' in APP_DOMAIN or '/' in APP_DOMAIN or '*' in APP_DOMAIN:
    raise ImproperlyConfigured('APP_DOMAIN must be a hostname, without a scheme or path.')
ALLOWED_HOSTS = [APP_DOMAIN, 'backend', 'localhost', '127.0.0.1']
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [f'https://{APP_DOMAIN}']
CSRF_TRUSTED_ORIGINS = [f'https://{APP_DOMAIN}']
ROOT_URLCONF = 'config.server_urls'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'  # noqa: F405
# Never impose policy on unrelated subdomains owned by the server administrator.
SECURE_HSTS_SECONDS = 3600 if DEPLOY_ENV == 'production' else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
# Only internal probes and the signature-verified LiveKit webhook use plain HTTP.
SECURE_REDIRECT_EXEMPT = [r'^healthz/$', r'^readyz/$', r'^api/recordings/webhook/$']

EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL') or f'noreply@{APP_DOMAIN}'
AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL') or None
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_FROM_NUMBER = os.environ.get('TWILIO_FROM_NUMBER', '')
if DEPLOY_ENV == 'staging':
    # Test data must never trigger real outgoing payments or SMS/email delivery.
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    TWILIO_ACCOUNT_SID = TWILIO_AUTH_TOKEN = TWILIO_FROM_NUMBER = ''
    STRIPE_PUBLIC_KEY = STRIPE_SECRET_KEY = STRIPE_WEBHOOK_SECRET = ''
