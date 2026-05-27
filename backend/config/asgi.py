import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from games.routing import websocket_urlpatterns as game_patterns
from accounts.routing import websocket_urlpatterns as notification_patterns

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': URLRouter(
        game_patterns +
        notification_patterns
    ),
})