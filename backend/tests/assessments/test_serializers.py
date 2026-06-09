from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from rest_framework.exceptions import ValidationError

from accounts.models import Organization, Session, AcademyClass, Course
from assessments.models import (
    QuestionBank,
    Question,
    Assessment,
    AssessmentQuestion,
    Submission,
    StudentAnswer,
)
from assessments.serializers import (
    QuestionBankSerializer,
    QuestionSerializer,
    QuestionStudentSerializer,
    AssessmentTeacherSerializer,
    AssessmentStudentSerializer,
    StudentAnswerSerializer,
    StudentAnswerTeacherSerializer,
    SubmissionStudentSerializer,
    SubmissionTeacherSerializer,
)

User = get_user_model()


class AssessmentSerializersTest(TestCase):
    def setUp(self):
        # Create users
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

        # Create organizations
        self.org = Organization.objects.create(
            name="Org One",
            slug="org-one",
            owner=self.teacher
        )
        self.other_org = Organization.objects.create(
            name="Org Two",
            slug="org-two",
            owner=self.teacher
        )

        # Create course & class
        self.course = Course.objects.create(
            organization=self.org,
            title="Math 101",
            code="MATH-101",
            price="50.00"
        )
        self.academy_class = AcademyClass.objects.create(
            course=self.course,
            name="Section A",
            created_by=self.teacher
        )

        # Create session
        self.session = Session.objects.create(
            academy_class=self.academy_class,
            organization=self.org,
            title="Lesson 1",
            host=self.teacher
        )

        # Create other organization session (for cross-tenant checks)
        self.other_course = Course.objects.create(
            organization=self.other_org,
            title="Other Course",
            code="OTHER-101",
            price="10.00"
        )
        self.other_class = AcademyClass.objects.create(
            course=self.other_course,
            name="Section B",
            created_by=self.teacher
        )
        self.other_session = Session.objects.create(
            academy_class=self.other_class,
            organization=self.other_org,
            title="Other Lesson",
            host=self.teacher
        )

        # Create question banks
        self.qbank = QuestionBank.objects.create(
            organization=self.org,
            title="Math QBank",
            created_by=self.teacher
        )
        self.other_qbank = QuestionBank.objects.create(
            organization=self.other_org,
            title="Other QBank",
            created_by=self.teacher
        )

        # Create question
        self.question = Question.objects.create(
            question_bank=self.qbank,
            text="What is 2 + 2?",
            question_type=Question.QuestionType.SINGLE_CHOICE,
            options=[{"id": "a", "text": "3"}, {"id": "b", "text": "4"}],
            correct_answer=["b"],
            points=Decimal("2.00")
        )

        # Create assessment
        self.assessment = Assessment.objects.create(
            organization=self.org,
            session=self.session,
            title="Math Quiz",
            created_by=self.teacher
        )
        AssessmentQuestion.objects.create(
            assessment=self.assessment,
            question=self.question,
            order=1,
            points=Decimal("2.00")
        )

        # Create submission
        self.submission = Submission.objects.create(
            assessment=self.assessment,
            student=self.student,
            status=Submission.Status.STARTED
        )
        self.student_answer = StudentAnswer.objects.create(
            submission=self.submission,
            question=self.question,
            selected_options=["b"]
        )

        # Setup mock request
        self.factory = APIRequestFactory()
        self.request = self.factory.get('/')
        self.request.user = self.teacher
        self.request.organization = self.org

    def test_question_bank_serializer_context_population(self):
        """Verify QuestionBankSerializer auto-populates organization and created_by."""
        serializer = QuestionBankSerializer(
            data={"title": "New Question Bank", "description": "Desc"},
            context={"request": self.request}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        qbank = serializer.save()
        self.assertEqual(qbank.organization, self.org)
        self.assertEqual(qbank.created_by, self.teacher)

    def test_question_serializer_multi_tenant_validation(self):
        """Verify QuestionSerializer rejects question banks belonging to another tenant."""
        # 1. Valid question bank (same org)
        serializer_valid = QuestionSerializer(
            data={
                "question_bank": self.qbank.id,
                "text": "Valid?",
                "question_type": Question.QuestionType.TEXT,
                "correct_answer": "yes",
                "points": "1.00"
            },
            context={"request": self.request}
        )
        self.assertTrue(serializer_valid.is_valid(), serializer_valid.errors)

        # 2. Invalid question bank (other org)
        serializer_invalid = QuestionSerializer(
            data={
                "question_bank": self.other_qbank.id,
                "text": "Invalid?",
                "question_type": Question.QuestionType.TEXT,
                "correct_answer": "no",
                "points": "1.00"
            },
            context={"request": self.request}
        )
        with self.assertRaises(ValidationError) as ctx:
            serializer_invalid.is_valid(raise_exception=True)
        self.assertIn("Question bank does not belong to your organization.", str(ctx.exception))

    def test_question_student_serializer_strips_answer(self):
        """Verify QuestionStudentSerializer does not expose correct_answer."""
        # 1. Teacher serializer exposes correct answer
        teacher_data = QuestionSerializer(self.question).data
        self.assertIn("correct_answer", teacher_data)
        self.assertEqual(teacher_data["correct_answer"], ["b"])

        # 2. Student serializer strips correct answer
        student_data = QuestionStudentSerializer(self.question).data
        self.assertNotIn("correct_answer", student_data)

    def test_assessment_teacher_vs_student_serialization(self):
        """Verify Assessment serializers handle correct answers appropriately for roles."""
        # 1. Teacher version has questions with correct answers
        teacher_serializer = AssessmentTeacherSerializer(self.assessment)
        teacher_data = teacher_serializer.data
        self.assertEqual(len(teacher_data["questions"]), 1)
        self.assertIn("correct_answer", teacher_data["questions"][0]["question"])

        # 2. Student version has questions without correct answers
        student_serializer = AssessmentStudentSerializer(self.assessment)
        student_data = student_serializer.data
        self.assertEqual(len(student_data["questions"]), 1)
        self.assertNotIn("correct_answer", student_data["questions"][0]["question"])

    def test_assessment_serializer_session_validation(self):
        """Verify AssessmentTeacherSerializer rejects sessions from other organizations."""
        serializer = AssessmentTeacherSerializer(
            data={
                "title": "Cross Org Assessment",
                "session": self.other_session.id,
                "duration_minutes": 30,
                "passing_score": "50.00"
            },
            context={"request": self.request}
        )
        with self.assertRaises(ValidationError) as ctx:
            serializer.is_valid(raise_exception=True)
        self.assertIn("Session does not belong to your organization.", str(ctx.exception))

    def test_student_answer_serializer_read_only_fields(self):
        """Verify that students cannot modify grading/correctness/notes fields."""
        # Update from student perspective
        serializer = StudentAnswerSerializer(
            instance=self.student_answer,
            data={
                "selected_options": ["a"],
                "score": "100.00",
                "is_correct": True,
                "teacher_notes": "Cheating score attempt"
            },
            partial=True
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_sa = serializer.save()
        
        # selected_options is updated, but read-only fields remain original/default
        self.assertEqual(updated_sa.selected_options, ["a"])
        self.assertEqual(updated_sa.score, Decimal("0.00"))
        self.assertFalse(updated_sa.is_correct)
        self.assertEqual(updated_sa.teacher_notes, "")

    def test_student_answer_teacher_serializer_write_access(self):
        """Verify that teachers can grade and add notes to student answers."""
        serializer = StudentAnswerTeacherSerializer(
            instance=self.student_answer,
            data={
                "score": "2.00",
                "is_correct": True,
                "teacher_notes": "Well done!"
            },
            partial=True
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        graded_sa = serializer.save()
        
        self.assertEqual(graded_sa.score, Decimal("2.00"))
        self.assertTrue(graded_sa.is_correct)
        self.assertEqual(graded_sa.teacher_notes, "Well done!")

    def test_submission_student_vs_teacher_nested_serialization(self):
        """Verify Submission serializers include correct nested structures for each role."""
        # 1. Student version strips teacher feedback notes and scores
        student_sub_data = SubmissionStudentSerializer(self.submission).data
        self.assertNotIn("graded_by", student_sub_data)
        self.assertIn("answers", student_sub_data)
        self.assertEqual(len(student_sub_data["answers"]), 1)
        self.assertNotIn("teacher_notes", student_sub_data["answers"][0])

        # 2. Teacher version includes full evaluations
        teacher_sub_data = SubmissionTeacherSerializer(self.submission).data
        self.assertIn("graded_by", teacher_sub_data)
        self.assertIn("answers", teacher_sub_data)
        self.assertEqual(len(teacher_sub_data["answers"]), 1)
        self.assertIn("teacher_notes", teacher_sub_data["answers"][0])
