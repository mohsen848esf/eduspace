import logging
import random
import string
from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils import timezone

from accounts.models import Session, AcademyClass
from accounts.permissions import has_org_permission
from accounts.services.audit_service import AuditService
from rooms.models import Room, RoomParticipant

logger = logging.getLogger(__name__)


def _generate_unique_room_code():
    from rooms.models import Room
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not Room.objects.filter(room_code=code).exists():
            return code


class SessionService:
    @staticmethod
    def start_session(session_id: int, actor=None) -> Session:
        """
        Transition session status SCHEDULED -> LIVE, create a Room, and assign it to session.active_room.
        Enforces pessimistic locking using select_for_update on both AcademyClass and Session to avoid races.
        
        State transition rules:
        - Allowed transitions: SCHEDULED -> LIVE
        - Idempotent: LIVE -> LIVE (no-op)
        - Invalid: COMPLETED/CANCELLED -> LIVE ( ValidationError )
        """
        with transaction.atomic():
            # First lock the Session row
            try:
                session = Session.objects.select_for_update().get(pk=session_id)
            except Session.DoesNotExist:
                raise ValidationError("Session does not exist.")

            # Validate organization membership/permission
            org = session.get_organization()
            if actor:
                if not has_org_permission(actor, org, 'can_manage_sessions') and session.host != actor:
                    raise PermissionDenied("You do not have permission to manage sessions in this organization.")

            current = session.status
            if current == Session.Status.LIVE:
                return session  # Idempotent return if already live
            
            if current != Session.Status.SCHEDULED:
                raise ValidationError(f"Cannot start session. Invalid transition from {current} to LIVE.")

            # Lock the AcademyClass to serialize operations for sessions belonging to this class
            if session.academy_class_id:
                # Lock the class row to prevent race conditions on duplicate live sessions
                AcademyClass.objects.select_for_update().get(pk=session.academy_class_id)
                
                # Check again if another live session exists for this class
                live_sessions = Session.objects.filter(
                    academy_class=session.academy_class,
                    status=Session.Status.LIVE
                ).exclude(pk=session.pk)
                if live_sessions.exists():
                    raise ValidationError("Only one live session is allowed per class at a time.")

            # Generate and create the Room
            room_code = _generate_unique_room_code()
            
            room = Room.objects.create(
                name=session.title,
                room_code=room_code,
                host=session.host,
                session=session,
                organization=org,
                meeting_type='class_session',
                max_participants=20,
                status=Room.Status.ACTIVE,
                started_at=timezone.now()
            )
            
            # Create RoomParticipant for host
            RoomParticipant.objects.create(
                room=room,
                user=session.host,
                role=RoomParticipant.Role.HOST,
                is_active=True,
                joined_at=timezone.now()
            )

            before_state = {
                'status': current,
                'active_room_id': None
            }

            session.active_room = room
            session.status = Session.Status.LIVE
            session.save()

            after_state = {
                'status': session.status,
                'active_room_id': room.id
            }

            AuditService.log(
                actor=actor,
                action='session.started',
                entity=session,
                before=before_state,
                after=after_state,
                organization=org
            )

            # Notify enrolled students that session has started
            try:
                if session.academy_class:
                    from accounts.models import Enrollment
                    from accounts.notifications import record_and_dispatch_many
                    student_ids = Enrollment.objects.filter(
                        academy_class=session.academy_class,
                        is_active=True
                    ).values_list('student_id', flat=True)
                    if student_ids:
                        record_and_dispatch_many(
                            user_ids=student_ids,
                            kind="SESSION_STARTED",
                            data={
                                "session_id": session.id,
                                "session_title": session.title,
                                "room_code": room.room_code,
                                "class_name": session.academy_class.name,
                                "host_name": session.host.full_name or session.host.username,
                            }
                        )
            except Exception:
                pass

            return session

    @staticmethod
    def complete_session(session_id: int, actor=None) -> Session:
        """
        Transition session status LIVE -> COMPLETED. Ends the active room and triggers
        AttendanceService post-commit.
        
        State transition rules:
        - Allowed transitions: LIVE -> COMPLETED
        - Idempotent: COMPLETED -> COMPLETED (no-op)
        - Invalid: SCHEDULED/CANCELLED -> COMPLETED ( ValidationError )
        """
        with transaction.atomic():
            try:
                session = Session.objects.select_for_update().get(pk=session_id)
            except Session.DoesNotExist:
                raise ValidationError("Session does not exist.")

            # Validate organization membership/permission
            org = session.get_organization()
            if actor:
                if not has_org_permission(actor, org, 'can_manage_sessions') and session.host != actor:
                    raise PermissionDenied("You do not have permission to manage sessions in this organization.")

            current = session.status
            if current == Session.Status.COMPLETED:
                return session  # Idempotent return if already completed

            if current != Session.Status.LIVE:
                raise ValidationError(f"Cannot complete session. Invalid transition from {current} to COMPLETED.")

            if session.academy_class_id:
                AcademyClass.objects.select_for_update().get(pk=session.academy_class_id)

            before_state = {
                'status': current
            }

            # End active room if it exists
            room = session.active_room
            if room:
                room.status = Room.Status.ENDED
                room.ended_at = timezone.now()
                room.save(update_fields=['status', 'ended_at'])
                # Deactivate participants
                room.participants.filter(is_active=True).update(is_active=False, left_at=timezone.now())

            session.status = Session.Status.COMPLETED
            session.save()

            after_state = {
                'status': session.status
            }

            AuditService.log(
                actor=actor,
                action='session.completed',
                entity=session,
                before=before_state,
                after=after_state,
                organization=org
            )

            # Trigger attendance processing after successful commit
            from accounts.services.attendance_service import AttendanceService
            transaction.on_commit(lambda: AttendanceService.on_session_completed(session_id))

            return session

    @staticmethod
    def cancel_session(session_id: int, actor=None) -> Session:
        """
        Transition session status SCHEDULED or LIVE -> CANCELLED.
        
        State transition rules:
        - Allowed transitions: SCHEDULED -> CANCELLED, LIVE -> CANCELLED
        - Idempotent: CANCELLED -> CANCELLED (no-op)
        - Invalid: COMPLETED -> CANCELLED ( ValidationError )
        """
        with transaction.atomic():
            try:
                session = Session.objects.select_for_update().get(pk=session_id)
            except Session.DoesNotExist:
                raise ValidationError("Session does not exist.")

            org = session.get_organization()
            if actor:
                if not has_org_permission(actor, org, 'can_manage_sessions'):
                    raise PermissionDenied("You do not have permission to manage sessions in this organization.")

            current = session.status
            if current == Session.Status.CANCELLED:
                return session  # Idempotent

            if current not in (Session.Status.SCHEDULED, Session.Status.LIVE):
                raise ValidationError(f"Cannot cancel session. Invalid transition from {current} to CANCELLED.")

            if session.academy_class_id:
                AcademyClass.objects.select_for_update().get(pk=session.academy_class_id)

            before_state = {
                'status': current
            }

            # If LIVE, end active room
            room = session.active_room
            if room:
                room.status = Room.Status.ENDED
                room.ended_at = timezone.now()
                room.save(update_fields=['status', 'ended_at'])
                room.participants.filter(is_active=True).update(is_active=False, left_at=timezone.now())

            session.status = Session.Status.CANCELLED
            session.save()

            after_state = {
                'status': session.status
            }

            AuditService.log(
                actor=actor,
                action='session.cancelled',
                entity=session,
                before=before_state,
                after=after_state,
                organization=org
            )

            return session
