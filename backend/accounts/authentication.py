from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from accounts.models import UserSession

class SessionJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        session_id = validated_token.get('session_id')
        if session_id:
            try:
                session = UserSession.objects.select_related('user').get(id=session_id)
                if not session.is_active:
                    raise InvalidToken("Session has been revoked or is inactive.")
                if session.user_id != user.id:
                    raise InvalidToken("Session user mismatch.")
            except UserSession.DoesNotExist:
                raise InvalidToken("Session not found.")
        return user
