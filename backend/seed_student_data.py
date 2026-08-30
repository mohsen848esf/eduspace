import os
import django
from django.utils import timezone
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounts.models import User, Organization, Role, OrgMember, Course, AcademyClass, Enrollment, TuitionInvoice, Session, Attendance, Notification
from assessments.models import QuestionBank, Question, Assessment, AssessmentQuestion, Submission

def run():
    print("Seeding student data...")
    try:
        org = Organization.objects.get(slug='default-academy')
    except Organization.DoesNotExist:
        print("Default organization not found.")
        return

    # Find the student user
    try:
        student = User.objects.get(username='test1new')
        print(f"Found student user: {student.username}")
    except User.DoesNotExist:
        student = User.objects.filter(org_memberships__role__name='Student').first()
        if not student:
            student = User.objects.create(username='test1new', email='test1new@example.com', full_name='Test Student')
            student.set_password('Pass123$')
            student.save()
            student_role, _ = Role.objects.get_or_create(name='Student', organization=None)
            OrgMember.objects.get_or_create(user=student, organization=org, defaults={'role': student_role})
            print(f"Created student user: {student.username}")
        else:
            print(f"Using fallback student user: {student.username}")

    # Create a teacher
    teacher, _ = User.objects.get_or_create(username='teacher_bob', defaults={'email': 'bob@test.com', 'full_name': 'Bob Teacher'})
    teacher.set_password('Pass123$')
    teacher.save()
    
    teacher_role, _ = Role.objects.get_or_create(name='Teacher', organization=None)
    OrgMember.objects.get_or_create(user=teacher, organization=org, defaults={'role': teacher_role})

    # Courses
    course_react, _ = Course.objects.get_or_create(organization=org, title='Introduction to React', code='REACT101', price='150.00')
    course_django, _ = Course.objects.get_or_create(organization=org, title='Advanced Django', code='DJ102', price='200.00')

    # Classes
    class_react, _ = AcademyClass.objects.get_or_create(course=course_react, name='React Summer 2026', teacher=teacher)
    class_django, _ = AcademyClass.objects.get_or_create(course=course_django, name='Django Fall 2026', teacher=teacher)

    # Enroll student
    Enrollment.objects.get_or_create(academy_class=class_react, student=student, defaults={'is_active': True})
    Enrollment.objects.get_or_create(academy_class=class_django, student=student, defaults={'is_active': True})

    # Invoices
    TuitionInvoice.objects.get_or_create(organization=org, student=student, academy_class=class_react, amount='150.00', status='paid')
    TuitionInvoice.objects.get_or_create(organization=org, student=student, academy_class=class_django, amount='200.00', status='unpaid')

    # Sessions
    now = timezone.now()
    
    # 1. Live Session
    session_live, _ = Session.objects.get_or_create(organization=org, academy_class=class_react, title='React Components (Live)', defaults={'status': 'live', 'host': teacher, 'scheduled_start': now})
    
    # 2. Future Session
    session_future, _ = Session.objects.get_or_create(organization=org, academy_class=class_react, title='React Hooks (Upcoming)', defaults={'status': 'scheduled', 'host': teacher, 'scheduled_start': now + timedelta(days=1)})
    
    # 3. Completed Session (Attended)
    session_past_attended, _ = Session.objects.get_or_create(organization=org, academy_class=class_django, title='Django ORM Intro', defaults={'status': 'completed', 'host': teacher, 'scheduled_start': now - timedelta(days=2)})
    Attendance.objects.get_or_create(session=session_past_attended, student=student, defaults={'status': 'present'})

    # 4. Completed Session (Missed)
    session_past_missed, _ = Session.objects.get_or_create(organization=org, academy_class=class_django, title='Django Views', defaults={'status': 'completed', 'host': teacher, 'scheduled_start': now - timedelta(days=1)})
    Attendance.objects.get_or_create(session=session_past_missed, student=student, defaults={'status': 'absent'})

    # Assessments
    bank, _ = QuestionBank.objects.get_or_create(organization=org, title='Web Dev Basics')
    q1, _ = Question.objects.get_or_create(question_bank=bank, text='What is React?', question_type='short_answer', defaults={'points': '10.00', 'correct_answer': 'A JS library'})
    q2, _ = Question.objects.get_or_create(question_bank=bank, text='What is Django?', question_type='short_answer', defaults={'points': '10.00', 'correct_answer': 'A Python framework'})

    # Assessment 1: Pending (Published, not started)
    assess_pending, _ = Assessment.objects.get_or_create(organization=org, title='React Midterm', session=session_future, defaults={'is_published': True, 'duration_minutes': 60, 'passing_score': '50.00'})
    AssessmentQuestion.objects.get_or_create(assessment=assess_pending, question=q1, defaults={'order': 1, 'points': '10.00'})

    # Assessment 2: Started
    assess_started, _ = Assessment.objects.get_or_create(organization=org, title='Django Quiz 1', session=session_live, defaults={'is_published': True, 'duration_minutes': 30})
    AssessmentQuestion.objects.get_or_create(assessment=assess_started, question=q2, defaults={'order': 1, 'points': '10.00'})
    Submission.objects.get_or_create(assessment=assess_started, student=student, defaults={'status': 'started'})

    # Assessment 3: Completed/Graded
    assess_graded, _ = Assessment.objects.get_or_create(organization=org, title='Django Entry Exam', defaults={'is_published': True, 'duration_minutes': 45})
    Submission.objects.get_or_create(assessment=assess_graded, student=student, defaults={'status': 'graded', 'score': '18.50'})

    # Notifications
    Notification.objects.get_or_create(user=student, kind='system', defaults={'payload': {'title': 'Welcome to Eduspace!', 'message': 'We are glad you are here.'}, 'read_at': now})
    Notification.objects.get_or_create(user=student, kind='reminder', defaults={'payload': {'title': 'Upcoming Class!', 'message': 'React Hooks is starting tomorrow.'}, 'read_at': None})

    print("Seed completed successfully!")

if __name__ == '__main__':
    run()
