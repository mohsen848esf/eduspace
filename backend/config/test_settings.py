from .settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'test-unique-cache',
    }
}

TEST_RUNNER = 'config.test_runner.CacheClearingDiscoverRunner'

# Celery Testing Settings
CELERY_TASK_ALWAYS_EAGER = True


