import logging
from django.utils import timezone
from accounts.models import User, OrgMember, Enrollment, AcademyClass, Session, Certificate, UserSession
from accounts.services.audit_service import AuditService

logger = logging.getLogger(__name__)

class PrivacyService:
    @classmethod
    def compile_user_personal_data(cls, user: User) -> dict:
        """
        Compiles all Personally Identifiable Information (PII) and activity records
        related to the user into a serializable dictionary format for GDPR data exports.
        """
        # User Demographics & Profile
        profile_data = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "date_joined": user.date_joined.isoformat() if user.date_joined else None,
            "created_at": user.created_at.isoformat() if hasattr(user, 'created_at') and user.created_at else None,
        }

        # Organization Memberships
        memberships = []
        for member in OrgMember.objects.filter(user=user):
            memberships.append({
                "organization_id": member.organization.id,
                "organization_name": member.organization.name,
                "role": member.role.name if member.role else None,
                "joined_at": member.joined_at.isoformat() if member.joined_at else None,
                "contract_type": member.contract_type,
                "is_active": member.is_active,
            })

        # Course Enrollments
        enrollments = []
        for enr in Enrollment.objects.filter(student=user):
            enrollments.append({
                "class_id": enr.academy_class.id,
                "class_name": enr.academy_class.name,
                "course_title": enr.academy_class.course.title,
                "course_code": enr.academy_class.course.code,
                "enrolled_at": enr.enrolled_at.isoformat() if enr.enrolled_at else None,
                "completion_status": enr.completion_status,
                "completion_date": enr.completion_date.isoformat() if enr.completion_date else None,
                "is_active": enr.is_active,
            })

        # Classes Taught
        classes_taught = []
        for ac in AcademyClass.objects.filter(teacher=user):
            classes_taught.append({
                "class_id": ac.id,
                "class_name": ac.name,
                "course_title": ac.course.title,
                "course_code": ac.course.code,
                "start_date": ac.start_date.isoformat() if ac.start_date else None,
                "end_date": ac.end_date.isoformat() if ac.end_date else None,
            })

        # Sessions Hosted
        sessions_hosted = []
        for sess in Session.objects.filter(host=user):
            sessions_hosted.append({
                "session_id": sess.id,
                "title": sess.title,
                "scheduled_start": sess.scheduled_start.isoformat() if sess.scheduled_start else None,
                "scheduled_end": sess.scheduled_end.isoformat() if sess.scheduled_end else None,
                "status": sess.status,
            })

        # Exam Submissions
        submissions = []
        try:
            from assessments.models import Submission
            for sub in Submission.objects.filter(student=user):
                submissions.append({
                    "submission_id": sub.id,
                    "assessment_title": sub.assessment.title,
                    "status": sub.status,
                    "grade": str(sub.grade) if sub.grade is not None else None,
                    "started_at": sub.started_at.isoformat() if sub.started_at else None,
                    "completed_at": sub.completed_at.isoformat() if sub.completed_at else None,
                    "focus_loss_count": sub.focus_loss_count,
                })
        except ImportError:
            logger.warning("Submission or assessments models not found. Skipping submissions compilation.")

        # Academic Certificates
        certificates = []
        for cert in Certificate.objects.filter(student=user):
            certificates.append({
                "certificate_number": cert.certificate_number,
                "class_name": cert.academy_class.name,
                "course_title": cert.academy_class.course.title,
                "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
            })

        # Notification Preferences
        notification_preferences = []
        try:
            from notifications.models import NotificationPreference
            for pref in NotificationPreference.objects.filter(user=user):
                notification_preferences.append({
                    "channel": pref.channel,
                    "enabled": pref.enabled,
                })
        except ImportError:
            pass

        return {
            "profile": profile_data,
            "memberships": memberships,
            "enrollments": enrollments,
            "classes_taught": classes_taught,
            "sessions_hosted": sessions_hosted,
            "submissions": submissions,
            "certificates": certificates,
            "notification_preferences": notification_preferences,
            "exported_at": timezone.now().isoformat(),
        }

    @classmethod
    def anonymize_and_purge_user(cls, user: User, actor=None, request=None):
        """
        Anonymizes user PII details, deactivates credentials/sessions, and deactivates active links.
        This complies with the GDPR Right to Erasure while maintaining statistical database records.
        """
        before_state = {
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
        }

        # Clear active tokens and session logs
        UserSession.objects.filter(user=user).delete()

        # Set Anonymized values
        user.full_name = "Anonymized GDPR User"
        user.email = f"deleted_user_{user.id}@deleted.eduspace.com"
        user.username = f"deleted_user_{user.id}"
        user.avatar = None
        user.is_active = False
        user.is_online = False
        user.set_unusable_password()
        user.save()

        # Deactivate OrgMember links
        OrgMember.objects.filter(user=user).update(is_active=False)

        # Deactivate Enrollments
        Enrollment.objects.filter(student=user).update(is_active=False)

        # Remove direct teacher links to preserve structure, or set to null
        AcademyClass.objects.filter(teacher=user).update(teacher=None)

        # Log audit trail using AuditService
        AuditService.log(
            actor=actor or user,
            action="user.privacy_purge",
            entity=user,
            before=before_state,
            after={
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
            },
            request=request
        )

        logger.info(f"Successfully processed GDPR anonymization purge for User ID {user.id}")
