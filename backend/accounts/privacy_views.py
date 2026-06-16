from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.services.privacy_services import PrivacyService

class PrivacyExportView(APIView):
    """
    API endpoint for authenticated users to request an export of all their personal data (GDPR Compliance).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        try:
            export_data = PrivacyService.compile_user_personal_data(user)
            return Response(export_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"Failed to compile personal records: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AccountPurgeView(APIView):
    """
    API endpoint for authenticated users to deactivate and scramble their user credentials (GDPR Compliance).
    Requires password verification to execute.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get("password")
        if not password:
            return Response(
                {"detail": "Verification password is required to request erasure."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        if not user.check_password(password):
            return Response(
                {"detail": "Incorrect password. Verification failed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            PrivacyService.anonymize_and_purge_user(
                user=user,
                actor=user,
                request=request
            )
            return Response(
                {"detail": "Your account has been successfully anonymized and deactivated. All active login sessions have been terminated."},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"detail": f"Erasure failed due to system exception: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
