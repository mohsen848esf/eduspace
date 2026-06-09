from django.test import TestCase
from django.db import IntegrityError
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from accounts.models import Organization, Session, AcademyClass, Course
from assessments.models import (
    QuestionBank,
    Question,
    Assessment,
    AssessmentQuestion,
    Submission,
    StudentAnswer,
)

User = get_user_model()


class AssessmentModelsTest(TestCase):
    def setUp(self):
        # Create user
        self.teacher = User.objects.create_user(
            username="teacher1",
            email="teacher1@example.com",
            password="password123",
            role="teacher"
        )
        self.student = User.objects.create_user(
            username="student1",
            email="student1@example.com",
            password="password123",
            role="student"
        )

        # Create organization
        self.org = Organization.objects.create(
            name="Test Org",
            slug="test-org",
            owner=self.teacher
        )

        # Create course and class (required for Session)
        self.course = Course.objects.create(
            organization=self.org,
            title="Intro to Coding",
            code="CS-101",
            price="100.00"
        )
        self.academy_class = AcademyClass.objects.create(
            course=self.course,
            name="Group Alpha",
            start_date="2026-06-01",
            end_date="2026-07-01",
            created_by=self.teacher
        )

        # Create session
        self.session = Session.objects.create(
            academy_class=self.academy_class,
            organization=self.org,
            title="Lesson 1",
            host=self.teacher
        )

        # Create question bank
        self.qbank = QuestionBank.objects.create(
            organization=self.org,
            title="Midterm Question Bank",
            description="Bank for midterm questions",
            created_by=self.teacher
        )

    def test_question_bank_creation(self):
        """Verify QuestionBank attributes and multi-tenant constraints."""
        self.assertEqual(self.qbank.title, "Midterm Question Bank")
        self.assertEqual(self.qbank.organization, self.org)
        self.assertEqual(self.qbank.created_by, self.teacher)

        # Cascading delete checks
        org_id = self.org.id
        self.org.delete()
        with self.assertRaises(QuestionBank.DoesNotExist):
            QuestionBank.objects.get(id=self.qbank.id)

    def test_question_creation(self):
        """Verify Question creation and its attributes."""
        question = Question.objects.create(
            question_bank=self.qbank,
            text="What is 2 + 2?",
            question_type=Question.QuestionType.SINGLE_CHOICE,
            options=[
                {"id": "a", "text": "3"},
                {"id": "b", "text": "4"},
                {"id": "c", "text": "5"}
            ],
            correct_answer=["b"],
            points=2.50
        )

        self.assertEqual(question.text, "What is 2 + 2?")
        self.assertEqual(question.question_type, Question.QuestionType.SINGLE_CHOICE)
        self.assertEqual(question.points, 2.50)
        self.assertEqual(question.options[1]["text"], "4")

    def test_assessment_creation_and_defaults(self):
        """Verify Assessment model relations and default values."""
        assessment = Assessment.objects.create(
            organization=self.org,
            session=self.session,
            title="Quiz 1",
            created_by=self.teacher
        )

        self.assertEqual(assessment.title, "Quiz 1")
        self.assertEqual(assessment.session, self.session)
        self.assertEqual(assessment.duration_minutes, 60)
        self.assertEqual(assessment.passing_score, 50.00)
        self.assertFalse(assessment.is_published)

    def test_assessment_question_through_ordering(self):
        """Verify many-to-many through-model order and point override."""
        q1 = Question.objects.create(
            question_bank=self.qbank,
            text="Question 1",
            correct_answer={"text": "ans1"}
        )
        q2 = Question.objects.create(
            question_bank=self.qbank,
            text="Question 2",
            correct_answer={"text": "ans2"}
        )

        assessment = Assessment.objects.create(
            organization=self.org,
            title="Combined Test",
            created_by=self.teacher
        )

        # Link questions via through-model
        aq1 = AssessmentQuestion.objects.create(
            assessment=assessment,
            question=q1,
            order=2,
            points=10.00
        )
        aq2 = AssessmentQuestion.objects.create(
            assessment=assessment,
            question=q2,
            order=1,
            points=15.00
        )

        # Verify through points override
        self.assertEqual(aq1.points, 10.00)
        self.assertEqual(aq2.points, 15.00)

        # Check default ordering by order field
        questions = list(assessment.questions.all().order_by('assessmentquestion__order'))
        self.assertEqual(questions[0], q2)  # q2 has order=1
        self.assertEqual(questions[1], q1)  # q1 has order=2

    def test_submission_and_anti_cheat_telemetry(self):
        """Verify Submission creation, defaults, and anti-cheat fields."""
        assessment = Assessment.objects.create(
            organization=self.org,
            title="Final Exam",
            created_by=self.teacher
        )

        submission = Submission.objects.create(
            assessment=assessment,
            student=self.student,
            browser_info="Mozilla/5.0 (Windows NT 10.0)",
            ip_address="192.168.1.50"
        )

        self.assertEqual(submission.status, Submission.Status.STARTED)
        self.assertEqual(submission.score, 0.00)
        self.assertEqual(submission.tab_focus_losses, 0)
        self.assertEqual(submission.browser_info, "Mozilla/5.0 (Windows NT 10.0)")
        self.assertEqual(submission.ip_address, "192.168.1.50")

    def test_student_answer_uniqueness_constraint(self):
        """Verify duplicate answers to the same question in a submission are rejected."""
        q = Question.objects.create(
            question_bank=self.qbank,
            text="Q1",
            correct_answer={"text": "ans"}
        )
        assessment = Assessment.objects.create(
            organization=self.org,
            title="Test",
            created_by=self.teacher
        )
        submission = Submission.objects.create(
            assessment=assessment,
            student=self.student
        )

        # First answer is okay
        StudentAnswer.objects.create(
            submission=submission,
            question=q,
            text_answer="first attempt"
        )

        # Second answer to the same question within the submission should raise IntegrityError
        with self.assertRaises(IntegrityError):
            StudentAnswer.objects.create(
                submission=submission,
                question=q,
                text_answer="second attempt"
            )

    def test_question_archive_and_restore(self):
        """Verify that questions can be archived and restored, updating active querysets."""
        q = Question.objects.create(
            question_bank=self.qbank,
            text="Temporary Question",
            correct_answer={"text": "temp"}
        )
        self.assertTrue(q.is_active)
        self.assertIn(q, Question.objects.active())

        # Archive the question
        q.archive()
        self.assertFalse(q.is_active)
        self.assertNotIn(q, Question.objects.active())
        self.assertIn(q, Question.objects.with_archived())

        # Restore the question
        q.restore()
        self.assertTrue(q.is_active)
        self.assertIn(q, Question.objects.active())

    def test_historical_preservation_when_archived(self):
        """Verify that archiving a question keeps linked historical assessment and student answer records intact."""
        q = Question.objects.create(
            question_bank=self.qbank,
            text="Historical Question",
            correct_answer={"text": "hist"}
        )
        assessment = Assessment.objects.create(
            organization=self.org,
            title="Archived Question Test Exam",
            created_by=self.teacher
        )
        aq = AssessmentQuestion.objects.create(
            assessment=assessment,
            question=q,
            order=1,
            points=5.00
        )
        submission = Submission.objects.create(
            assessment=assessment,
            student=self.student
        )
        sa = StudentAnswer.objects.create(
            submission=submission,
            question=q,
            text_answer="hist",
            score=5.00,
            is_correct=True
        )

        # Archive the question
        q.archive()

        # Verify through-relations and answer logs remain valid and queryable
        self.assertTrue(AssessmentQuestion.objects.filter(id=aq.id).exists())
        self.assertTrue(StudentAnswer.objects.filter(id=sa.id).exists())

        # Verify historical submissions grading queries still evaluate correctly
        reloaded_sa = StudentAnswer.objects.get(id=sa.id)
        self.assertEqual(reloaded_sa.score, 5.00)
        self.assertTrue(reloaded_sa.is_correct)
        self.assertEqual(reloaded_sa.question.text, "Historical Question")

