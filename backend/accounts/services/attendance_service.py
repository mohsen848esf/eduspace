from django.db import transaction
from django.utils import timezone
from accounts.models import Enrollment, Attendance, User

class AttendanceService:
    @staticmethod
    @transaction.atomic
    def auto_populate(session):
        """
        Automatically populate attendance records for a session based on the enrolled
        students of the associated academy class and actual room participants.
        """
        # 1. Fetch enrolled students
        enrolled_students = []
        if session.academy_class:
            enrollments = Enrollment.objects.filter(academy_class=session.academy_class, is_active=True)
            for enrollment in enrollments:
                enrolled_students.append(enrollment.student)
                
        # Create default ABSENT records for all enrolled students
        attendance_map = {}
        for student in enrolled_students:
            attendance, created = Attendance.objects.get_or_create(
                session=session,
                student=student,
                defaults={'status': Attendance.Status.ABSENT}
            )
            attendance_map[student.id] = attendance
            
        # 2. Check room participants if room exists
        room = getattr(session, 'room', None)
        if room:
            from rooms.models import RoomParticipant
            participants = RoomParticipant.objects.filter(room=room)
            
            for participant in participants:
                # Exclude the session host/teacher from student attendance lists
                if participant.user_id == session.host_id:
                    continue
                
                # Fetch or create attendance record
                attendance = attendance_map.get(participant.user_id)
                if not attendance:
                    attendance, created = Attendance.objects.get_or_create(
                        session=session,
                        student=participant.user,
                        defaults={'status': Attendance.Status.PRESENT}
                    )
                    attendance_map[participant.user_id] = attendance
                
                # Update attendance record based on participant timestamps
                attendance.status = Attendance.Status.PRESENT
                attendance.joined_at = participant.joined_at
                
                if participant.left_at:
                    attendance.left_at = participant.left_at
                elif participant.is_active:
                    attendance.left_at = timezone.now()
                
                attendance.save()
