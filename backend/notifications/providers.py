import logging
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)

class EmailProvider:
    def send_email(self, to_email: str, subject: str, body: str) -> bool:
        raise NotImplementedError


class SMTPProvider(EmailProvider):
    def send_email(self, to_email: str, subject: str, body: str) -> bool:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@eduspace.com')
        logger.info("Sending SMTP email to %s with subject: %s", to_email, subject)
        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=[to_email],
            fail_silently=False,
        )
        return True


class SMSProvider:
    def send_sms(self, to_phone: str, message: str) -> bool:
        raise NotImplementedError


class TwilioProvider(SMSProvider):
    def send_sms(self, to_phone: str, message: str) -> bool:
        account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
        auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
        from_number = getattr(settings, 'TWILIO_FROM_NUMBER', '')
        
        if not account_sid or not auth_token:
            logger.info("[MOCK SMS] Twilio not configured. To: %s, Message: %s", to_phone, message)
            return True
            
        from twilio.rest import Client
        logger.info("Sending Twilio SMS to %s", to_phone)
        client = Client(account_sid, auth_token)
        client.messages.create(
            body=message,
            from_=from_number,
            to=to_phone
        )
        return True
