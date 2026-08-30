from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.urls import path
from django.views.decorators.http import require_safe

from .urls import urlpatterns as application_urls


@require_safe
def healthz(request):
    return JsonResponse({'status': 'ok'})


@require_safe
def readyz(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        # Read only: don't create health-check files or publish diagnostic secrets.
        cache.get('eduspace-readiness')
    except Exception:
        return JsonResponse({'status': 'unavailable'}, status=503)
    return JsonResponse({'status': 'ok'})


urlpatterns = [path('healthz/', healthz), path('readyz/', readyz), *application_urls]
