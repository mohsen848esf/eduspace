import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


class NotificationConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope.get('user')

        if not self.user or isinstance(self.user, AnonymousUser):
            query_string = self.scope.get('query_string', b'').decode()
            token = None
            for param in query_string.split('&'):
                if param.startswith('token='):
                    token = param.split('=', 1)[1]
                    break

            if token:
                self.user = await self.get_user_from_token(token)

        if not self.user or isinstance(self.user, AnonymousUser):
            print('WS rejected: no auth')
            await self.close()
            return

        self.group_name = f'notifications_{self.user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print(f'WS connected: username={self.user.username}, id={self.user.id}, group={self.group_name}, channel={self.channel_name}')

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass

    async def send_notification(self, event):
        print(f'Sending notification to user: {event}')

        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def get_user_from_token(self, token):
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from accounts.models import User
            decoded = AccessToken(token)
            user_id = decoded.get('user_id')
            # user_id may come back as a string from the JWT payload.
            user = User.objects.get(id=int(user_id))
            print(f'WS auth: {user.username} (id={user.id})')
            return user
        except Exception as e:
            print(f'Token error: {e}')
            return AnonymousUser()