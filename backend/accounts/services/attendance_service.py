import logging
from django.db import transaction
from django.utils import timezone

from accounts.models import Session, Attendance, User
from rooms.models import RoomParticipant
from accounts.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class AttendanceService:
    @staticmethod
    def on_session_completed(session_id: int) -> None:
        """
        Populate or update attendance records for all enrolled students in the session's class.
        Executed post-commit (outside the select_for_update transaction).
        Uses a hybrid bulk-create/bulk-update strategy to avoid N+1 queries and prevent IntegrityErrors.
        """
        try:
            # We select_related to avoid N+1 queries when fetching organization/class context.
            session = Session.objects.select_related(
                'academy_class__course__organization', 
                'organization'
            ).get(pk=session_id)
        except Session.DoesNotExist:
            logger.error(f"Attendance generation failed: Session {session_id} not found.")
            return

        # Attendance is only generated for class-based sessions that are completed.
        if not session.academy_class_id or session.status != Session.Status.COMPLETED:
            logger.info(f"Skipping attendance generation for session {session_id} (not a completed class session).")
            return

        org = session.get_organization()

        # Fetch enrolled students
        enrolled_students = list(User.objects.filter(
            enrollments__academy_class=session.academy_class,
            enrollments__is_active=True
        ))

        if not enrolled_students:
            logger.info(f"No active enrollments for class of session {session_id}.")
            return

        with transaction.atomic():
            # Get existing attendance records to implement the hybrid update/create approach
            existing_attendances = {
                a.student_id: a for a in Attendance.objects.filter(session=session)
            }

            # Fetch participant records for all rooms associated with this session to compile presence data
            participants = RoomParticipant.objects.filter(room__session=session).select_related('room')

            # Calculate first join time and last leave time per participant
            presence_map = {}
            for p in participants:
                uid = p.user_id
                joined = p.joined_at
                left = p.left_at or p.room.ended_at or timezone.now()

                if uid not in presence_map:
                    presence_map[uid] = {
                        'joined_at': joined,
                        'left_at': left
                    }
                else:
                    if joined < presence_map[uid]['joined_at']:
                        presence_map[uid]['joined_at'] = joined
                    if left > presence_map[uid]['left_at']:
                        presence_map[uid]['left_at'] = left

            to_create = []
            to_update = []
            
            before_states = {}
            after_states = {}

            for student in enrolled_students:
                uid = student.id
                participated = uid in presence_map
                
                status = Attendance.Status.PRESENT if participated else Attendance.Status.ABSENT
                joined_at = presence_map[uid]['joined_at'] if participated else None
                left_at = presence_map[uid]['left_at'] if participated else None

                if uid in existing_attendances:
                    att = existing_attendances[uid]
                    if att.status != status or att.joined_at != joined_at or att.left_at != left_at:
                        before_states[student.username] = {
                            'status': att.status,
                            'joined_at': att.joined_at.isoformat() if att.joined_at else None,
                            'left_at': att.left_at.isoformat() if att.left_at else None,
                        }
                        att.status = status
                        att.joined_at = joined_at
                        att.left_at = left_at
                        to_update.append(att)
                        after_states[student.username] = {
                            'status': att.status,
                            'joined_at': att.joined_at.isoformat() if att.joined_at else None,
                            'left_at': att.left_at.isoformat() if att.left_at else None,
                        }
                else:
                    att = Attendance(
                        session=session,
                        student=student,
                        status=status,
                        joined_at=joined_at,
                        left_at=left_at
                    )
                    to_create.append(att)
                    after_states[student.username] = {
                        'status': status,
                        'joined_at': joined_at.isoformat() if joined_at else None,
                        'left_at': left_at.isoformat() if left_at else None,
                    }

            if to_create:
                Attendance.objects.bulk_create(to_create)
            if to_update:
                Attendance.objects.bulk_update(to_update, fields=['status', 'joined_at', 'left_at'])

            # Log audit event for attendance generation
            AuditService.log(
                actor=None,
                action='attendance.generated',
                entity=session,
                before={
                    'existing_count': len(existing_attendances),
                    'detail': before_states
                },
                after={
                    'created_count': len(to_create),
                    'updated_count': len(to_update),
                    'detail': after_states
                },
                organization=org
            )
