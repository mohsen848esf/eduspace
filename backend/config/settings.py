from pathlib import Path
from dotenv import load_dotenv
from datetime import timedelta
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = ['*']

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
    # Local
    'accounts',
    'games',
    'rooms',
    'assessments',
    'corsheaders',

]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

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
        'LOCATION': f"redis://{os.getenv('REDIS_HOST', 'localhost')}:6379/1",
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}
ORG_CONTEXT_CACHE_TTL = 86400

AUTH_USER_MODEL = 'accounts.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
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

# ---------------------------------------------------------------------------
# LiveKit
# ---------------------------------------------------------------------------
# Credentials and URLs are loaded from the environment so production deploys
# can rotate them without code changes. Defaults stay safe for the local
# dev stack defined in docker-compose.yml.
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY', 'devkey')
LIVEKIT_API_SECRET = os.getenv(
    'LIVEKIT_API_SECRET',
    'devsecret',
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
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'loggers': {
        'rooms': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'accounts': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'games': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
    },
}
