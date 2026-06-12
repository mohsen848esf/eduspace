from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.utils import timezone
from accounts.models import Organization, Session, AcademyClass, Course, AuditLog
from assessments.models import (
    QuestionBank,
    Question,
    Assessment,
    AssessmentQuestion,
    Submission,
    StudentAnswer,
)
from assessments.services.grading_service import GradingService
from assessments.services.anti_cheat_service import AntiCheatService
from assessments.services.assessment_service import AssessmentService

User = get_user_model()

class AssessmentServicesTest(TestCase):
    def setUp(self):
        # Create users
        self.teacher = User.objects.create_user(
            username="teacher1",
            email="teacher1@example.com",
            password="password123"
        )
        self.student = User.objects.create_user(
            username="student1",
            email="student1@example.com",
            password="password123"
        )
        # Create organization
        self.org = Organization.objects.create(
            name="Test Org",
            slug="test-org",
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
        # Create question bank
        self.qbank = QuestionBank.objects.create(
            organization=self.org,
            title="Algebra Questions",
            created_by=self.teacher
        )
        # Create questions
        self.q_single = Question.objects.create(
            question_bank=self.qbank,
            text="What is x in x + 2 = 5?",
            question_type=Question.QuestionType.SINGLE_CHOICE,
            options=[{"id": "a", "text": "2"}, {"id": "b", "text": "3"}, {"id": "c", "text": "4"}],
            correct_answer=["b"],
            points=Decimal("3.00")
        )
        self.q_multi = Question.objects.create(
            question_bank=self.qbank,
            text="Which are prime numbers?",
            question_type=Question.QuestionType.MULTIPLE_CHOICE,
            options=[{"id": "a", "text": "2"}, {"id": "b", "text": "4"}, {"id": "c", "text": "5"}],
            correct_answer=["a", "c"],
            points=Decimal("4.00")
        )
        self.q_text = Question.objects.create(
            question_bank=self.qbank,
            text="What is the capital of France?",
            question_type=Question.QuestionType.TEXT,
            correct_answer="Paris",
            points=Decimal("2.00")
        )
        self.q_code = Question.objects.create(
            question_bank=self.qbank,
            text="Write a function to return sum of a and b.",
            question_type=Question.QuestionType.CODE,
            correct_answer="def add(a,b): return a+b",
            points=Decimal("10.00")
        )
        # Create Assessment
        self.assessment = Assessment.objects.create(
            organization=self.org,
            title="Midterm Exam",
            created_by=self.teacher
        )
        # Add questions to assessment
        AssessmentQuestion.objects.create(assessment=self.assessment, question=self.q_single, order=1, points=Decimal("3.00"))
        AssessmentQuestion.objects.create(assessment=self.assessment, question=self.q_multi, order=2, points=Decimal("4.00"))
        AssessmentQuestion.objects.create(assessment=self.assessment, question=self.q_text, order=3, points=Decimal("2.00"))
        AssessmentQuestion.objects.create(assessment=self.assessment, question=self.q_code, order=4, points=Decimal("8.00"))  # points override

    def test_start_and_resume_submission(self):
        """Verify start_submission pre-populates layout and resumption rules."""
        # 1. Start submission
        submission = AssessmentService.start_submission(
            assessment=self.assessment,
            student=self.student,
            browser_info="Chrome/Windows",
            ip_address="127.0.0.1"
        )
        
        self.assertEqual(submission.status, Submission.Status.STARTED)
        self.assertEqual(submission.student, self.student)
        self.assertEqual(submission.browser_info, "Chrome/Windows")
        self.assertEqual(submission.ip_address, "127.0.0.1")
        
        # Check pre-populated answers (4 questions)
        answers = submission.answers.all()
        self.assertEqual(answers.count(), 4)
        
        # Verify ordering is correct
        ans_list = list(answers.order_by('question__assessmentquestion__order'))
        self.assertEqual(ans_list[0].question, self.q_single)
        self.assertEqual(ans_list[3].question, self.q_code)
        
        # 2. Resume submission
        resumed = AssessmentService.start_submission(
            assessment=self.assessment,
            student=self.student,
            browser_info="Chrome/Mac",
            ip_address="192.168.1.1"
        )
        self.assertEqual(resumed.pk, submission.pk)
        self.assertEqual(resumed.browser_info, "Chrome/Mac")
        self.assertEqual(resumed.ip_address, "192.168.1.1")
        self.assertEqual(resumed.answers.count(), 4) # Should not create duplicate answers

        # 3. Duplicate submission prevention after submit
        resumed.status = Submission.Status.SUBMITTED
        resumed.save()
        
        with self.assertRaises(ValidationError):
            AssessmentService.start_submission(
                assessment=self.assessment,
                student=self.student
            )

    def test_auto_grading_happy_path(self):
        """Verify auto-grading choices and text matches correctly."""
        submission = AssessmentService.start_submission(
            assessment=self.assessment,
            student=self.student
        )
        
        # Fill answers
        ans_single = submission.answers.get(question=self.q_single)
        ans_single.selected_options = ["b"] # Correct
        ans_single.save()
        
        ans_multi = submission.answers.get(question=self.q_multi)
        ans_multi.selected_options = ["c", "a"] # Correct (order independent)
        ans_multi.save()
        
        ans_text = submission.answers.get(question=self.q_text)
        ans_text.text_answer = " paris  " # Correct (stripped/case-insensitive)
        ans_text.save()

        # Submit
        submitted = AssessmentService.submit_assessment(submission)
        
        # Since q_code (code question) is present, it cannot be fully auto-graded.
        # It should be in SUBMITTED status.
        self.assertEqual(submitted.status, Submission.Status.SUBMITTED)
        
        # Verify scores
        ans_single.refresh_from_db()
        self.assertEqual(ans_single.score, Decimal("3.00"))
        self.assertTrue(ans_single.is_correct)
        
        ans_multi.refresh_from_db()
        self.assertEqual(ans_multi.score, Decimal("4.00"))
        self.assertTrue(ans_multi.is_correct)
        
        ans_text.refresh_from_db()
        self.assertEqual(ans_text.score, Decimal("2.00"))
        self.assertTrue(ans_text.is_correct)
        
        ans_code = submitted.answers.get(question=self.q_code)
        self.assertEqual(ans_code.score, Decimal("0.00"))
        self.assertFalse(ans_code.is_correct)
        
        # Total score should be 3 + 4 + 2 = 9
        submitted.refresh_from_db()
        self.assertEqual(submitted.score, Decimal("9.00"))

    def test_auto_grading_incorrect_answers(self):
        """Verify incorrect choice answers and text answers score 0."""
        submission = AssessmentService.start_submission(
            assessment=self.assessment,
            student=self.student
        )
        
        # Fill incorrect answers
        ans_single = submission.answers.get(question=self.q_single)
        ans_single.selected_options = ["a"] # Incorrect
        ans_single.save()
        
        ans_multi = submission.answers.get(question=self.q_multi)
        ans_multi.selected_options = ["a"] # Partial is incorrect
        ans_multi.save()
        
        ans_text = submission.answers.get(question=self.q_text)
        ans_text.text_answer = "London" # Incorrect
        ans_text.save()

        submitted = AssessmentService.submit_assessment(submission)
        
        # Verify scores are 0
        ans_single.refresh_from_db()
        self.assertEqual(ans_single.score, Decimal("0.00"))
        self.assertFalse(ans_single.is_correct)
        
        ans_multi.refresh_from_db()
        self.assertEqual(ans_multi.score, Decimal("0.00"))
        self.assertFalse(ans_multi.is_correct)
        
        ans_text.refresh_from_db()
        self.assertEqual(ans_text.score, Decimal("0.00"))
        self.assertFalse(ans_text.is_correct)

    def test_auto_grading_fully_auto_graded_assessment(self):
        """Verify that an assessment with only auto-gradable questions is graded immediately."""
        # Create an assessment with only choice and text questions
        auto_assessment = Assessment.objects.create(
            organization=self.org,
            title="Auto Exam",
            created_by=self.teacher
        )
        AssessmentQuestion.objects.create(assessment=auto_assessment, question=self.q_single, order=1, points=Decimal("3.00"))
        AssessmentQuestion.objects.create(assessment=auto_assessment, question=self.q_text, order=2, points=Decimal("2.00"))
        
        submission = AssessmentService.start_submission(
            assessment=auto_assessment,
            student=self.student
        )
        
        ans_single = submission.answers.get(question=self.q_single)
        ans_single.selected_options = ["b"]
        ans_single.save()
        
        ans_text = submission.answers.get(question=self.q_text)
        ans_text.text_answer = "Paris"
        ans_text.save()
        
        # Submit
        submitted = AssessmentService.submit_assessment(submission)
        
        # It should transition straight to GRADED because there are no manual review items
        self.assertEqual(submitted.status, Submission.Status.GRADED)
        self.assertEqual(submitted.score, Decimal("5.00"))

    def test_manual_grading_and_teacher_overrides(self):
        """Verify teacher grading overrides and final submission grading lifecycle."""
        submission = AssessmentService.start_submission(
            assessment=self.assessment,
            student=self.student
        )
        
        # Submit (empty answers)
        submitted = AssessmentService.submit_assessment(submission)
        self.assertEqual(submitted.status, Submission.Status.SUBMITTED)
        self.assertEqual(submitted.score, Decimal("0.00"))
        
        # Teacher grades the submission
        ans_code = submitted.answers.get(question=self.q_code)
        ans_single = submitted.answers.get(question=self.q_single)
        
        grades_dict = {
            str(self.q_code.id): {"score": Decimal("6.50"), "is_correct": True, "teacher_notes": "Good logic"},
            str(self.q_single.id): {"score": Decimal("3.00"), "is_correct": True, "teacher_notes": "Override to correct"}
        }
        
        graded = AssessmentService.grade_submission(
            submission=submitted,
            graded_by=self.teacher,
            grades_dict=grades_dict
        )
        
        self.assertEqual(graded.status, Submission.Status.GRADED)
        self.assertEqual(graded.graded_by, self.teacher)
        self.assertIsNotNone(graded.graded_at)
        
        # Check answer detail updates
        ans_code.refresh_from_db()
        self.assertEqual(ans_code.score, Decimal("6.50"))
        self.assertTrue(ans_code.is_correct)
        self.assertEqual(ans_code.teacher_notes, "Good logic")
        
        ans_single.refresh_from_db()
        self.assertEqual(ans_single.score, Decimal("3.00"))
        self.assertTrue(ans_single.is_correct)
        self.assertEqual(ans_single.teacher_notes, "Override to correct")
        
        # Overall score should be 6.50 + 3.00 = 9.50
        self.assertEqual(graded.score, Decimal("9.50"))

    def test_anti_cheat_telemetry_and_anomalies(self):
        """Verify tab loss incrementing, telemetry updates, and anomaly detection."""
        submission = AssessmentService.start_submission(
            assessment=self.assessment,
            student=self.student
        )
        
        # 1. Update Telemetry
        AntiCheatService.update_telemetry(
            submission=submission,
            ip_address="10.0.0.5",
            browser_info="Firefox/Mac"
        )
        submission.refresh_from_db()
        self.assertEqual(submission.ip_address, "10.0.0.5")
        self.assertEqual(submission.browser_info, "Firefox/Mac")
        
        # 2. Record tab losses
        AntiCheatService.record_tab_loss(submission, actor=self.student)
        AntiCheatService.record_tab_loss(submission, actor=self.student)
        submission.refresh_from_db()
        self.assertEqual(submission.tab_focus_losses, 2)
        
        # Verify anomalies (threshold = 1) -> flagged
        report = AntiCheatService.check_anomalies(submission, max_tab_losses=1)
        self.assertTrue(report["is_flagged"])
        self.assertEqual(report["tab_focus_losses"], 2)
        
        # Verify anomalies (threshold = 3) -> not flagged
        report2 = AntiCheatService.check_anomalies(submission, max_tab_losses=3)
        self.assertFalse(report2["is_flagged"])

    def test_service_audit_logging(self):
        """Verify AuditLog records are generated during service operations."""
        AuditLog.objects.all().delete()
        
        # 1. Start submission triggers audit log
        with self.captureOnCommitCallbacks(execute=True):
            submission = AssessmentService.start_submission(
                assessment=self.assessment,
                student=self.student
            )
        
        log_start = AuditLog.objects.filter(action="submission.started").first()
        self.assertIsNotNone(log_start)
        self.assertEqual(log_start.actor, self.student)
        self.assertEqual(log_start.entity_id, submission.pk)
        
        # 2. Tab focus loss triggers audit log
        with self.captureOnCommitCallbacks(execute=True):
            AntiCheatService.record_tab_loss(submission, actor=self.student)
            
        log_tab = AuditLog.objects.filter(action="submission.tab_focus_loss_recorded").first()
        self.assertIsNotNone(log_tab)
        self.assertEqual(log_tab.actor, self.student)
        self.assertEqual(log_tab.entity_id, submission.pk)
        self.assertEqual(log_tab.before_state, {"tab_focus_losses": 0})
        self.assertEqual(log_tab.after_state, {"tab_focus_losses": 1})

    def test_manual_grading_validation(self):
        """Verify boundary and validation rules for manual grading."""
        submission = AssessmentService.start_submission(
            assessment=self.assessment,
            student=self.student
        )
        
        # Test case: Valid score
        # q_code points = 8.00 (points override in AssessmentQuestion)
        ans_code = submission.answers.get(question=self.q_code)
        
        # 1. Valid score (7.00 out of 8.00)
        GradingService.manual_grade_answer(
            student_answer=ans_code,
            score=Decimal("7.00"),
            is_correct=True,
            teacher_notes="Good effort",
            graded_by=self.teacher
        )
        ans_code.refresh_from_db()
        self.assertEqual(ans_code.score, Decimal("7.00"))
        
        # 2. Invalid Negative (score = -1.00)
        with self.assertRaises(ValidationError) as ctx:
            GradingService.manual_grade_answer(
                student_answer=ans_code,
                score=Decimal("-1.00"),
                is_correct=False,
                graded_by=self.teacher
            )
        self.assertIn("Score cannot be negative.", str(ctx.exception))
        
        # 3. Invalid Over Maximum (score = 15.00 out of 8.00)
        with self.assertRaises(ValidationError) as ctx:
            GradingService.manual_grade_answer(
                student_answer=ans_code,
                score=Decimal("15.00"),
                is_correct=False,
                graded_by=self.teacher
            )
        self.assertIn("Score cannot exceed question maximum points.", str(ctx.exception))

        # 4. Boundary check: full points (8.00 out of 8.00)
        GradingService.manual_grade_answer(
            student_answer=ans_code,
            score=Decimal("8.00"),
            is_correct=True,
            graded_by=self.teacher
        )
        ans_code.refresh_from_db()
        self.assertEqual(ans_code.score, Decimal("8.00"))

        # 5. Boundary check: zero points on a 0-point question
        assessment_zero = Assessment.objects.create(
            organization=self.org,
            title="Zero point assessment",
            created_by=self.teacher
        )
        q_zero = Question.objects.create(
            question_bank=self.qbank,
            text="Zero point question",
            question_type=Question.QuestionType.TEXT,
            correct_answer="any",
            points=Decimal("0.00")
        )
        AssessmentQuestion.objects.create(
            assessment=assessment_zero,
            question=q_zero,
            order=1,
            points=Decimal("0.00")
        )
        submission_new = AssessmentService.start_submission(
            assessment=assessment_zero,
            student=self.student
        )
        ans_zero = submission_new.answers.get(question=q_zero)
        
        # 0 score on 0 points: PASS
        GradingService.manual_grade_answer(
            student_answer=ans_zero,
            score=Decimal("0.00"),
            is_correct=True,
            graded_by=self.teacher
        )
        ans_zero.refresh_from_db()
        self.assertEqual(ans_zero.score, Decimal("0.00"))

        # 1 score on 0 points: FAIL
        with self.assertRaises(ValidationError) as ctx:
            GradingService.manual_grade_answer(
                student_answer=ans_zero,
                score=Decimal("1.00"),
                is_correct=False,
                graded_by=self.teacher
            )
        self.assertIn("Score cannot exceed question maximum points.", str(ctx.exception))

        # 6. Test AssessmentService.grade_submission validations
        submission_for_bulk = AssessmentService.start_submission(
            assessment=self.assessment,
            student=self.student
        )
        submission_for_bulk.status = Submission.Status.SUBMITTED
        submission_for_bulk.save()

        # Grade dictionary with negative score
        grades_dict_neg = {
            str(self.q_code.id): {"score": Decimal("-1.00"), "is_correct": False}
        }
        with self.assertRaises(ValidationError) as ctx:
            AssessmentService.grade_submission(
                submission=submission_for_bulk,
                graded_by=self.teacher,
                grades_dict=grades_dict_neg
            )
        self.assertIn("Score cannot be negative.", str(ctx.exception))

        # Grade dictionary with score > max_points
        grades_dict_over = {
            str(self.q_code.id): {"score": Decimal("20.00"), "is_correct": True}
        }
        with self.assertRaises(ValidationError) as ctx:
            AssessmentService.grade_submission(
                submission=submission_for_bulk,
                graded_by=self.teacher,
                grades_dict=grades_dict_over
            )
        self.assertIn("Score cannot exceed question maximum points.", str(ctx.exception))
