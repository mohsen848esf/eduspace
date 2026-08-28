from django.utils.deprecation import MiddlewareMixin
from django.conf import settings

class MediaFrameSecurityMiddleware(MiddlewareMixin):
    """
    Middleware to allow embedding of media files (PDFs, images, slides)
    inside iframe viewers across different local and production origins.
    Removes restrictive X-Frame-Options and sets permissive frame-ancestors CSP.
    """
    def process_response(self, request, response):
        media_url = getattr(settings, 'MEDIA_URL', '/media/')
        if request.path.startswith(media_url) or request.path.startswith('/media/'):
            # Mark as exempt for Django's XFrameOptionsMiddleware
            response.xframe_options_exempt = True
            
            # Remove X-Frame-Options if already added
            if 'X-Frame-Options' in response:
                del response['X-Frame-Options']
            elif 'x-frame-options' in response:
                del response['x-frame-options']
                
            # Allow framing from localhost frontend / dev ports and HTTPS domains
            response['Content-Security-Policy'] = "frame-ancestors 'self' http://localhost:* http://127.0.0.1:* https://*;"
            response['Access-Control-Allow-Origin'] = '*'
            response['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
            response['Access-Control-Allow-Headers'] = '*'
            response['X-Content-Type-Options'] = 'nosniff'

            if request.path.startswith(f'{media_url}room_presentations/'):
                response['Content-Security-Policy'] = (
                    "default-src 'none'; img-src 'self' data:; "
                    "style-src 'unsafe-inline'; "
                    "frame-ancestors 'self' http://localhost:* http://127.0.0.1:* https://*;"
                )
            
        return response
