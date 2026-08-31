from datetime import timedelta
import os
from pathlib import Path
import sys

from corsheaders.defaults import default_headers
from dotenv import load_dotenv

from config.security import validate_signing_secret

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'channels',
    'django_celery_beat',
    # Local
    'accounts',
    'games',
    'rooms',
    'media_library',
    'assessments',
    'corsheaders',
    'notifications',
    'analytics',
    'sys_admin',
    'billing',
]

MIDDLEWARE = [
    'accounts.logging_middleware.StructuredLoggingMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'sys_admin.middleware.SuspensionMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'config.media_middleware.MediaFrameSecurityMiddleware',
]

X_FRAME_OPTIONS = 'SAMEORIGIN'

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

if os.getenv('USE_SQLITE', 'False').lower() == 'true':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'eduspace'),
            'USER': os.getenv('DB_USER', 'edu'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'edupass123'),
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '5432'),
        }
    }

if os.getenv('USE_SQLITE', 'False').lower() == 'true':
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'local-memory-cache',
        }
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [(os.getenv('REDIS_HOST', 'localhost'), 6379)],
            },
        },
    }
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': f"redis://{os.getenv('REDIS_HOST', 'localhost')}:6379/2",
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            }
        }
    }
ORG_CONTEXT_CACHE_TTL = 86400

# Celery Configuration
CELERY_BROKER_URL = f"redis://{os.getenv('REDIS_HOST', 'localhost')}:6379/0"
CELERY_RESULT_BACKEND = f"redis://{os.getenv('REDIS_HOST', 'localhost')}:6379/1"
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Tehran'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_TASK_DEFAULT_QUEUE = 'default'
CELERY_TASK_ROUTES = {
    'accounts.tasks.send_email_task': {'queue': 'notifications'},
    'accounts.tasks.send_sms_task': {'queue': 'notifications'},
    'notifications.tasks.dispatch_notification_task': {'queue': 'notifications'},
    'notifications.tasks.class_broadcast_task': {'queue': 'notifications'},
    'rooms.tasks.finalize_client_recording_task': {'queue': 'recordings'},
    'rooms.tasks.finalize_recording_task': {'queue': 'recordings'},
    'rooms.tasks.convert_presentation_document_task': {'queue': 'documents'},
    'media_library.tasks.inspect_media_asset_task': {'queue': 'media'},
    'media_library.tasks.transcode_media_asset_task': {'queue': 'media'},
    'media_library.tasks.verify_progressive_media_chunk_task': {'queue': 'media'},
    'media_library.tasks.ingest_progressive_media_upload_task': {'queue': 'media-ingest'},
    'accounts.tasks.export_audit_logs_task': {'queue': 'compliance'},
    'accounts.tasks.monthly_generate_billing_and_usage_reports': {'queue': 'finance'},
    'accounts.tasks.weekly_recalculate_reports_and_storage': {'queue': 'finance'},
    'sys_admin.tasks.daily_usage_recalculation': {'queue': 'finance'},
    'billing.tasks.payment_recovery_task': {'queue': 'finance'},
}

GOTENBERG_URL = os.getenv('GOTENBERG_URL', 'http://localhost:3000').rstrip('/')
PRESENTATION_MAX_UPLOAD_BYTES = int(os.getenv('PRESENTATION_MAX_UPLOAD_BYTES', 50 * 1024 * 1024))
PRESENTATION_MAX_OUTPUT_BYTES = int(os.getenv('PRESENTATION_MAX_OUTPUT_BYTES', 100 * 1024 * 1024))
PRESENTATION_MAX_PAGES = int(os.getenv('PRESENTATION_MAX_PAGES', 300))
PRESENTATION_MAX_IMAGE_PIXELS = int(os.getenv('PRESENTATION_MAX_IMAGE_PIXELS', 40_000_000))
PRESENTATION_CONVERSION_TIMEOUT_SECONDS = int(
    os.getenv('PRESENTATION_CONVERSION_TIMEOUT_SECONDS', 120)
)
PRESENTATION_SOURCE_ROOT = BASE_DIR / 'private_media' / 'presentation_sources'

AUTH_USER_MODEL = 'accounts.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'accounts.authentication.SessionJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'accounts.throttling.TenantUserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '600/minute',
        'authentication': '10/minute',
        'assessments': '120/minute',
        'public': '60/minute',
    },
    'EXCEPTION_HANDLER': 'accounts.exceptions.custom_exception_handler',
}
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Tehran'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

# Media files (user-uploaded + server-generated assets like recordings).
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
}

CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

CORS_ALLOW_CREDENTIALS = True

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True

CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-organization-slug',
    'x-guest-access-token',
]

# ---------------------------------------------------------------------------
# LiveKit
# ---------------------------------------------------------------------------
# Credentials and URLs are loaded from the environment so production deploys
# can rotate them without code changes. Defaults stay safe for the local
# dev stack defined in docker-compose.yml.
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY', 'devkey')
_LOCAL_DEV_LIVEKIT_API_SECRET = 'eduspace-local-livekit-secret-change-before-production'
LIVEKIT_API_SECRET = validate_signing_secret(
    os.getenv(
        'LIVEKIT_API_SECRET',
        _LOCAL_DEV_LIVEKIT_API_SECRET,
    ),
    setting_name='LIVEKIT_API_SECRET',
    forbidden_values=() if DEBUG else (_LOCAL_DEV_LIVEKIT_API_SECRET,),
)
LIVEKIT_HOST_URL = os.getenv('LIVEKIT_HOST_URL', 'http://localhost:7880')
LIVEKIT_WS_URL = os.getenv('LIVEKIT_WS_URL', 'ws://localhost:7880')

# ---------------------------------------------------------------------------
# Session recording
# ---------------------------------------------------------------------------
# Default capture quality. Hosts can override per-session.
RECORDING_DEFAULT_QUALITY = os.getenv('RECORDING_DEFAULT_QUALITY', '720p')

# Where the egress worker drops finished MP4 files. Stored relative to
# MEDIA_ROOT so Django's storage helpers can serve them.
_recording_subdir = os.getenv('RECORDING_OUTPUT_DIR', 'media/recordings')
# Strip a leading "media/" if present so the path is always relative to MEDIA_ROOT.
if _recording_subdir.startswith('media/'):
    _recording_subdir = _recording_subdir[len('media/'):]
RECORDING_OUTPUT_SUBDIR = _recording_subdir
RECORDING_OUTPUT_DIR = MEDIA_ROOT / RECORDING_OUTPUT_SUBDIR

# Hard cap so a runaway egress can't fill the disk.
RECORDING_MAX_DURATION_SECONDS = int(
    os.getenv('RECORDING_MAX_DURATION_SECONDS', '14400'),
)

# Make sure the directory exists at startup so Django can serve from it.
os.makedirs(RECORDING_OUTPUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# S3 / MinIO Recording Storage
# ---------------------------------------------------------------------------
S3_ENABLED = os.getenv('S3_ENABLED', 'False').lower() == 'true'
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '')
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME', '')
AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL', None)
# Optional: a second endpoint for server-side calls (transcoding source
# download/upload, HLS delivery reads, chunk verification, ...) so the
# backend/workers can reach the object store directly over an internal
# network instead of round-tripping through whatever public path
# AWS_S3_ENDPOINT_URL points browsers at (e.g. the bundled MinIO proxied
# through nginx). Presigned URLs always use AWS_S3_ENDPOINT_URL regardless,
# since only the browser can reach that one. Falls back to
# AWS_S3_ENDPOINT_URL when unset, so real S3/R2 deployments are unaffected.
AWS_S3_INTERNAL_ENDPOINT_URL = os.getenv('AWS_S3_INTERNAL_ENDPOINT_URL', None)
AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
AWS_S3_ADDRESSING_STYLE = os.getenv('AWS_S3_ADDRESSING_STYLE', 'auto')
CDN_URL = os.getenv('CDN_URL', '')
MEDIA_UPLOAD_MAX_SIZE_BYTES = int(os.getenv('MEDIA_UPLOAD_MAX_SIZE_BYTES', str(10 * 1024**3)))
MEDIA_UPLOAD_PART_SIZE_BYTES = int(os.getenv('MEDIA_UPLOAD_PART_SIZE_BYTES', str(8 * 1024**2)))
MEDIA_UPLOAD_URL_TTL_SECONDS = int(os.getenv('MEDIA_UPLOAD_URL_TTL_SECONDS', '900'))
MEDIA_UPLOAD_SESSION_TTL_SECONDS = int(os.getenv('MEDIA_UPLOAD_SESSION_TTL_SECONDS', '86400'))
MEDIA_PROGRESSIVE_UPLOAD_ENABLED = os.getenv(
    'MEDIA_PROGRESSIVE_UPLOAD_ENABLED', 'False',
).lower() == 'true'
MEDIA_PROGRESSIVE_CHUNK_SIZE_BYTES = int(os.getenv(
    'MEDIA_PROGRESSIVE_CHUNK_SIZE_BYTES', str(8 * 1024**2),
))
MEDIA_PROGRESSIVE_PREFIX_PROBE_BYTES = int(os.getenv(
    'MEDIA_PROGRESSIVE_PREFIX_PROBE_BYTES', str(2 * 1024**2),
))
MEDIA_PROGRESSIVE_MIN_PLAYABLE_SECONDS = int(os.getenv(
    'MEDIA_PROGRESSIVE_MIN_PLAYABLE_SECONDS', '12',
))
MEDIA_PROGRESSIVE_INGEST_ENABLED = os.getenv(
    'MEDIA_PROGRESSIVE_INGEST_ENABLED', 'False',
).lower() == 'true'
MEDIA_PROGRESSIVE_INGEST_POLL_SECONDS = float(os.getenv(
    'MEDIA_PROGRESSIVE_INGEST_POLL_SECONDS', '0.5',
))
MEDIA_PROGRESSIVE_INGEST_TIMEOUT_SECONDS = int(os.getenv(
    'MEDIA_PROGRESSIVE_INGEST_TIMEOUT_SECONDS', '18000',
))
MEDIA_PROGRESSIVE_INGEST_LEASE_SECONDS = int(os.getenv(
    'MEDIA_PROGRESSIVE_INGEST_LEASE_SECONDS', '30',
))
MEDIA_PROGRESSIVE_SEEK_GUARD_MS = int(os.getenv(
    'MEDIA_PROGRESSIVE_SEEK_GUARD_MS', '8000',
))
MEDIA_INSPECTION_TIMEOUT_SECONDS = int(os.getenv('MEDIA_INSPECTION_TIMEOUT_SECONDS', '45'))
MEDIA_MAX_DURATION_SECONDS = int(os.getenv('MEDIA_MAX_DURATION_SECONDS', '14400'))
MEDIA_MAX_WIDTH = int(os.getenv('MEDIA_MAX_WIDTH', '7680'))
MEDIA_MAX_HEIGHT = int(os.getenv('MEDIA_MAX_HEIGHT', '4320'))
MEDIA_INSPECTION_TMP_ROOT = Path(
    os.getenv('MEDIA_INSPECTION_TMP_ROOT', BASE_DIR / 'private_media' / 'media_inspection')
)
MEDIA_TRANSCODE_TIMEOUT_SECONDS = int(os.getenv('MEDIA_TRANSCODE_TIMEOUT_SECONDS', '7200'))
MEDIA_TRANSCODE_THREADS = int(os.getenv('MEDIA_TRANSCODE_THREADS', '2'))
MEDIA_PLAYBACK_TICKET_TTL_SECONDS = int(os.getenv('MEDIA_PLAYBACK_TICKET_TTL_SECONDS', '900'))
MEDIA_PLAYBACK_OBJECT_URL_TTL_SECONDS = int(os.getenv('MEDIA_PLAYBACK_OBJECT_URL_TTL_SECONDS', '1200'))
MEDIA_PLAYBACK_DIRECT_OBJECT_URLS = os.getenv(
    'MEDIA_PLAYBACK_DIRECT_OBJECT_URLS', 'False',
).lower() == 'true'


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
# Send our app loggers to stdout at INFO so recording/webhook/egress events
# are visible in `runserver` / `uvicorn` output during development.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {
            'format': '[{asctime}] {levelname} {name}: {message}',
            'style': '{',
            'datefmt': '%H:%M:%S',
        },
        'json': {
            '()': 'accounts.logging_formatter.StructuredJSONFormatter',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
    },
    'loggers': {
        'rooms': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'accounts': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'games': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
    },
}

# ---------------------------------------------------------------------------
# Sentry Error Monitoring
# ---------------------------------------------------------------------------
TESTING = 'test' in sys.argv

SENTRY_DSN = os.getenv('SENTRY_DSN')
if SENTRY_DSN and not TESTING:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    
    def scrub_sentry_data(event, hint):
        if "request" in event:
            if "env" in event["request"]:
                event["request"]["env"].pop("REMOTE_ADDR", None)
                event["request"]["env"].pop("HTTP_X_FORWARDED_FOR", None)
            if "headers" in event["request"]:
                headers = event["request"]["headers"]
                for key in list(headers.keys()):
                    if key.lower() in ("authorization", "cookie", "set-cookie", "x-api-key"):
                        headers[key] = "[SCRUBBED]"
        if "user" in event:
            event["user"].pop("ip_address", None)
            event["user"].pop("email", None)
            event["user"].pop("username", None)
        return event

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=1.0 if DEBUG else 0.2,
        send_default_pii=False,
        before_send=scrub_sentry_data
    )


# ---------------------------------------------------------------------------
# Production Security Headers
# ---------------------------------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True


# ---------------------------------------------------------------------------
# Stripe SaaS Integration
# ---------------------------------------------------------------------------
STRIPE_PUBLIC_KEY = os.getenv('STRIPE_PUBLIC_KEY', '')
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')

