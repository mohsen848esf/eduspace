import uuid
import time
from django.utils.deprecation import MiddlewareMixin
from accounts.logging_context import set_logging_context, clear_logging_context
from accounts.metrics import HTTP_REQUESTS_TOTAL, HTTP_REQUEST_LATENCY_SECONDS

class StructuredLoggingMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._start_time = time.time()
        request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
        request.request_id = request_id
        
        user_id = None
        if hasattr(request, 'user') and request.user and request.user.is_authenticated:
            user_id = request.user.id
            
        org_id = None
        try:
            from accounts.permissions import resolve_organization
            org = resolve_organization(request)
            if org:
                org_id = org.id
        except Exception:
            pass
            
        set_logging_context(request_id=request_id, user_id=user_id, org_id=org_id)

    def process_response(self, request, response):
        if hasattr(request, 'request_id'):
            response['X-Request-ID'] = request.request_id
            
        # Update metrics
        if hasattr(request, '_start_time'):
            latency = time.time() - request._start_time
            endpoint = request.path
            method = request.method
            status_code = str(response.status_code)
            
            HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status_code=status_code).inc()
            HTTP_REQUEST_LATENCY_SECONDS.labels(method=method, endpoint=endpoint).observe(latency)

        clear_logging_context()
        return response

    def process_exception(self, request, exception):
        clear_logging_context()
