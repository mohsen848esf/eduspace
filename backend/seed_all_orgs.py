import os
import django
import random
from django.utils import timezone
from datetime import timedelta, date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounts.models import User, Organization, Role, OrgMember, Course, AcademyClass, Enrollment, TuitionInvoice, Session, Attendance
from assessments.models import QuestionBank, Question, Assessment, AssessmentQuestion, Submission

def run():
    print("Start seeding all organizations database with robust scheduling...")

    # Get or create Organizations
    org_default, _ = Organization.objects.get_or_create(slug='default-academy', defaults={
        'name': 'Default Academy',
        'type': 'organization',
        'owner': User.objects.get(id=1)
    })
    
    org_dandan, _ = Organization.objects.get_or_create(slug='dandan', defaults={
        'name': 'dandan',
        'type': 'organization',
        'owner': User.objects.get(id=1)
    })

    # Roles
    student_role, _ = Role.objects.get_or_create(name='Student', organization=None)
    teacher_role, _ = Role.objects.get_or_create(name='Teacher', organization=None)
    mentor_role, _ = Role.objects.get_or_create(name='Mentor', organization=None)
    admin_role, _ = Role.objects.get_or_create(name='Admin', organization=None)

    # Clean up previous seeded data
    print("Cleaning up old seeded data...")
    Course.objects.filter(organization__in=[org_default, org_dandan]).delete()
    TuitionInvoice.objects.filter(organization__in=[org_default, org_dandan]).delete()
    QuestionBank.objects.filter(organization__in=[org_default, org_dandan]).delete()
    
    # Delete previous user accounts (excluding superuser mohsen)
    User.objects.filter(username__startswith='default-academy_').delete()
    User.objects.filter(username__startswith='dandan_').delete()

    for org in [org_default, org_dandan]:
        slug = org.slug
        print(f"Seeding Organization: {org.name} ({slug})")

        # 1. Create Users
        # Students: 5
        students = []
        for i in range(1, 6):
            username = f"{slug}_student_{i}"
            email = f"{username}@eduspace.com"
            user = User.objects.create(username=username, email=email, full_name=f"Student {i} ({slug.upper()})")
            user.set_password('Pass123$')
            user.save()
            OrgMember.objects.create(user=user, organization=org, role=student_role)
            students.append(user)

        # Teachers: 3
        teachers = []
        for i in range(1, 4):
            username = f"{slug}_teacher_{i}"
            email = f"{username}@eduspace.com"
            user = User.objects.create(username=username, email=email, full_name=f"Teacher {i} ({slug.upper()})")
            user.set_password('Pass123$')
            user.save()
            OrgMember.objects.create(user=user, organization=org, role=teacher_role)
            teachers.append(user)

        # Mentors: 2
        mentors = []
        for i in range(1, 3):
            username = f"{slug}_mentor_{i}"
            email = f"{username}@eduspace.com"
            user = User.objects.create(username=username, email=email, full_name=f"Mentor {i} ({slug.upper()})")
            user.set_password('Pass123$')
            user.save()
            OrgMember.objects.create(user=user, organization=org, role=mentor_role)
            mentors.append(user)

        # 2. Create 3 Courses
        courses_data = [
            {"title": "Frontend Essentials", "code": "FE-101", "price": "150.00"},
            {"title": "Backend Engineering", "code": "BE-202", "price": "250.00"},
            {"title": "Database Fundamentals", "code": "DB-303", "price": "180.00"},
        ]
        
        courses = []
        for c_info in courses_data:
            course = Course.objects.create(
                organization=org,
                title=c_info["title"],
                code=c_info["code"],
                price=c_info["price"]
            )
            courses.append(course)

        # Question Bank for Assessments
        qbank = QuestionBank.objects.create(organization=org, title="General Test Bank")
        questions = []
        for i in range(1, 11):
            q = Question.objects.create(
                question_bank=qbank,
                text=f"Question {i} text for {slug.upper()}",
                question_type="text",
                correct_answer=f"Answer {i}"
            )
            questions.append(q)

        # 3. For each Course, create 3 Classes (9 classes total per Org)
        class_states = ["ongoing", "not_started", "completed"]
        
        for idx_c, course in enumerate(courses):
            for idx_cl, state in enumerate(class_states):
                class_name = f"{course.title} - Class {chr(65 + idx_cl)}"
                
                # Assign Teacher and Mentor
                teacher = teachers[idx_cl % len(teachers)]
                mentor = mentors[idx_cl % len(mentors)] if idx_cl % 2 == 0 else None # Mentor present or absent
                
                start_date = None
                end_date = None
                is_active = True
                
                today_date = date.today()
                if state == "ongoing":
                    start_date = today_date - timedelta(days=30)
                    end_date = today_date + timedelta(days=30)
                elif state == "not_started":
                    start_date = today_date + timedelta(days=30)
                    end_date = today_date + timedelta(days=90)
                elif state == "completed":
                    start_date = today_date - timedelta(days=90)
                    end_date = today_date - timedelta(days=30)
                    is_active = False

                ac_class = AcademyClass.objects.create(
                    course=course,
                    teacher=teacher,
                    mentor=mentor,
                    name=class_name,
                    start_date=start_date,
                    end_date=end_date,
                    is_active=is_active
                )

                # Enroll students
                for student in students:
                    Enrollment.objects.create(
                        academy_class=ac_class,
                        student=student,
                        is_active=True
                    )

                # Create Invoices
                for student in students:
                    # Stagger statuses: paid, unpaid, overdue
                    invoice_status = "paid"
                    if idx_cl == 1:
                        invoice_status = "unpaid"
                    elif idx_cl == 2:
                        invoice_status = "overdue"

                    TuitionInvoice.objects.create(
                        organization=org,
                        student=student,
                        academy_class=ac_class,
                        amount=course.price,
                        status=invoice_status,
                        due_date=date.today() + timedelta(days=10)
                    )

                # 4. Create 8 Sessions per Class
                # Staggered Session Times to prevent conflicts
                base_time = timezone.now()
                for i in range(1, 9):
                    title = f"Session {i} - Topic {i}"
                    
                    # Compute staggered, disjoint scheduling offsets based on course, class, and session index
                    # This ensures hosts have no overlapping sessions
                    session_status = "completed"
                    
                    if i == 7 and state == "ongoing":
                        session_status = "live"
                        scheduled_start = base_time - timedelta(minutes=30) + timedelta(hours=idx_c * 3)
                        scheduled_end = scheduled_start + timedelta(hours=1, minutes=30)
                    elif i == 8 or state == "not_started":
                        session_status = "scheduled"
                        offset_days = (idx_c * 30) + (idx_cl * 8) + i
                        scheduled_start = base_time + timedelta(days=offset_days)
                        scheduled_end = scheduled_start + timedelta(hours=1, minutes=30)
                    else:
                        # completed sessions (past)
                        offset_days = 150 - ((idx_c * 35) + (idx_cl * 9) + i)
                        scheduled_start = base_time - timedelta(days=offset_days)
                        scheduled_end = scheduled_start + timedelta(hours=1, minutes=30)

                    session = Session.objects.create(
                        academy_class=ac_class,
                        organization=org,
                        host=teacher,
                        title=title,
                        scheduled_start=scheduled_start,
                        scheduled_end=scheduled_end,
                        status=session_status
                    )

                    # Create Attendance for completed sessions
                    if session_status == "completed":
                        for student in students:
                            # Random attendance status: present, absent, late
                            att_status = random.choice(["present", "absent", "late"])
                            Attendance.objects.create(
                                session=session,
                                student=student,
                                status=att_status
                            )

                    # 5. Create 5 Assessments (Assignments) per Class
                    if i <= 5:
                        assess_title = f"Assignment {i} - {ac_class.name}"
                        is_published = True
                        if i == 5:
                            is_published = False # Draft
                        
                        assess = Assessment.objects.create(
                            organization=org,
                            session=session,
                            title=assess_title,
                            is_published=is_published,
                            duration_minutes=45
                        )
                        # Link a question
                        AssessmentQuestion.objects.create(
                            assessment=assess,
                            question=questions[i],
                            order=1,
                            points=10.00
                        )

                        # Create submissions for students
                        for student in students:
                            # i == 1: Graded
                            # i == 2: Submitted (Pending)
                            # i == 3: Started (In Progress)
                            # i >= 4: Not Started (No Submission)
                            if i == 1:
                                Submission.objects.create(
                                    assessment=assess,
                                    student=student,
                                    status="graded",
                                    score=8.50,
                                    graded_by=teacher,
                                    graded_at=timezone.now()
                                )
                            elif i == 2:
                                Submission.objects.create(
                                    assessment=assess,
                                    student=student,
                                    status="submitted",
                                    submitted_at=timezone.now()
                                )
                            elif i == 3:
                                Submission.objects.create(
                                    assessment=assess,
                                    student=student,
                                    status="started"
                                )

    print("Database seeding completed successfully!")

if __name__ == '__main__':
    run()
