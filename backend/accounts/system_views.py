from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import connection
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def health_check(request):
    # 1. Database check
    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        database_status = "ok"
    except Exception as e:
        database_status = f"error: {str(e)}"

    # 2. Redis/Cache check
    try:
        cache.set("health_check_ping", "pong", timeout=5)
        val = cache.get("health_check_ping")
        if val == "pong":
            redis_status = "ok"
        else:
            redis_status = "error: cache mismatch"
    except Exception as e:
        redis_status = f"error: {str(e)}"

    # 3. Celery check
    try:
        from config.celery import app as celery_app
        # Ping celery workers (inspect is non-blocking with small timeout)
        inspect_result = celery_app.control.ping(timeout=0.5)
        if inspect_result:
            celery_status = "ok"
        else:
            celery_status = "error: no active workers found"
    except Exception as e:
        celery_status = f"error: {str(e)}"

    # 4. Storage check
    try:
        file_name = "health_check_test.txt"
        file_content = ContentFile("health check")
        saved_path = default_storage.save(file_name, file_content)
        if default_storage.exists(saved_path):
            default_storage.delete(saved_path)
            storage_status = "ok"
        else:
            storage_status = "error: file not written"
    except Exception as e:
        storage_status = f"error: {str(e)}"

    response_data = {
        "database": database_status,
        "redis": redis_status,
        "celery": celery_status,
        "storage": storage_status,
    }

    # If any service failed, return HTTP 503 Service Unavailable
    if any(val.startswith("error") for val in response_data.values()):
        return Response(response_data, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response(response_data, status=status.HTTP_200_OK)
