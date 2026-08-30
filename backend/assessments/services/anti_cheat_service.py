from assessments.models import Submission
from accounts.services.audit_service import AuditService

class AntiCheatService:
    @staticmethod
    def record_tab_loss(submission: Submission, actor=None, request=None) -> int:
        """
        Atomically increments tab_focus_losses on the submission and logs an audit record.
        """
        before_state = {
            'tab_focus_losses': submission.tab_focus_losses
        }
        
        submission.tab_focus_losses += 1
        submission.save(update_fields=['tab_focus_losses'])
        
        after_state = {
            'tab_focus_losses': submission.tab_focus_losses
        }
        
        # Log to AuditService
        AuditService.log(
            actor=actor,
            action="submission.tab_focus_loss_recorded",
            entity=submission,
            before=before_state,
            after=after_state,
            request=request
        )
        
        return submission.tab_focus_losses

    @staticmethod
    def update_telemetry(submission: Submission, ip_address: str = None, browser_info: str = None) -> None:
        """
        Updates the telemetry fields (ip_address and browser_info) on the submission.
        """
        update_fields = []
        if ip_address is not None:
            submission.ip_address = ip_address
            update_fields.append('ip_address')
        if browser_info is not None:
            submission.browser_info = browser_info
            update_fields.append('browser_info')
            
        if update_fields:
            submission.save(update_fields=update_fields)

    @staticmethod
    def check_anomalies(submission: Submission, max_tab_losses: int = 3) -> dict:
        """
        Checks if the student's submission has triggered any anti-cheat anomalies.
        """
        is_flagged = submission.tab_focus_losses > max_tab_losses
        return {
            "is_flagged": is_flagged,
            "tab_focus_losses": submission.tab_focus_losses,
            "max_tab_losses": max_tab_losses
        }
