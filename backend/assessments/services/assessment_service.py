from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal

from assessments.models import Assessment, Submission, StudentAnswer, AssessmentQuestion, Question
from assessments.services.grading_service import GradingService
from assessments.services.anti_cheat_service import AntiCheatService
from accounts.services.audit_service import AuditService

class AssessmentService:
    @staticmethod
    def start_submission(assessment: Assessment, student, browser_info: str = "", ip_address: str = None, request=None) -> Submission:
        """
        Starts a new submission attempt for a student or resumes an active one.
        Pre-populates empty StudentAnswer slots for all questions in the assessment.
        """
        with transaction.atomic():
            # Check for existing submissions
            existing_submissions = Submission.objects.filter(assessment=assessment, student=student)
            
            # If there is a started one, resume it
            active_submission = existing_submissions.filter(status=Submission.Status.STARTED).first()
            if active_submission:
                # Update telemetry if provided
                AntiCheatService.update_telemetry(active_submission, ip_address, browser_info)
                return active_submission

            # If there are completed/graded ones, raise error
            completed_submission = existing_submissions.filter(
                status__in=[Submission.Status.SUBMITTED, Submission.Status.GRADED]
            ).first()
            if completed_submission:
                raise ValidationError("Assessment has already been submitted.")

            # Create new submission
            submission = Submission.objects.create(
                assessment=assessment,
                student=student,
                status=Submission.Status.STARTED,
                started_at=timezone.now(),
                browser_info=browser_info or "",
                ip_address=ip_address
            )

            # Pre-populate StudentAnswer slots
            aqs = AssessmentQuestion.objects.filter(assessment=assessment).order_by('order')
            student_answers = []
            for aq in aqs:
                student_answers.append(
                    StudentAnswer(
                        submission=submission,
                        question=aq.question,
                        selected_options=None,
                        text_answer="",
                        score=Decimal("0.00"),
                        is_correct=False
                    )
                )
            if student_answers:
                StudentAnswer.objects.bulk_create(student_answers)

            # Log to AuditService
            AuditService.log(
                actor=student,
                action="submission.started",
                entity=submission,
                request=request
            )

            return submission

    @staticmethod
    def submit_assessment(submission: Submission, request=None) -> Submission:
        """
        Finalizes a student's submission.
        Auto-grades choices and eligible text questions.
        Transitions status directly to GRADED if no manual grading is required.
        """
        with transaction.atomic():
            # Refresh and lock submission row
            submission = Submission.objects.select_for_update().get(pk=submission.pk)
            
            if submission.status != Submission.Status.STARTED:
                raise ValidationError("Only active submissions can be submitted.")

            submission.status = Submission.Status.SUBMITTED
            submission.submitted_at = timezone.now()
            submission.save()

            # Perform auto-grading
            GradingService.auto_grade_submission(submission)

            # Re-fetch answers to check if manual grading is needed
            answers = submission.answers.select_related('question').all()
            needs_manual = False
            for ans in answers:
                q_type = ans.question.question_type
                if q_type == Question.QuestionType.CODE:
                    needs_manual = True
                elif q_type == Question.QuestionType.TEXT:
                    # If student wrote something but it wasn't auto-matched as correct,
                    # mark it as needing manual review so teachers can award partial credits.
                    if not ans.is_correct and ans.text_answer and ans.text_answer.strip():
                        needs_manual = True

            before_status = Submission.Status.SUBMITTED
            if not needs_manual:
                submission.status = Submission.Status.GRADED
                submission.graded_at = timezone.now()
                submission.save()
                action = "submission.graded"
                after_status = Submission.Status.GRADED
            else:
                action = "submission.submitted"
                after_status = Submission.Status.SUBMITTED

            # Log to AuditService
            AuditService.log(
                actor=submission.student,
                action=action,
                entity=submission,
                before={"status": before_status},
                after={"status": after_status},
                request=request
            )

            return submission

    @staticmethod
    def grade_submission(submission: Submission, graded_by, grades_dict: dict, request=None) -> Submission:
        """
        Grades manual answers or overrides auto-graded scores.
        grades_dict format: {question_id_or_answer_id: {"score": Decimal, "is_correct": bool, "teacher_notes": str}}
        """
        with transaction.atomic():
            submission = Submission.objects.select_for_update().get(pk=submission.pk)
            
            # Pre-validate all scores in grades_dict to prevent partial grading on failure
            for key, grade_data in grades_dict.items():
                try:
                    lookup_id = int(key)
                except ValueError:
                    continue

                ans = submission.answers.filter(question_id=lookup_id).first()
                if not ans:
                    continue

                score = grade_data.get('score')
                if score is not None:
                    try:
                        score_dec = Decimal(str(score))
                    except Exception:
                        raise ValidationError("Score must be a valid number.")

                    # Determine max_points
                    try:
                        aq = AssessmentQuestion.objects.get(
                            assessment=submission.assessment,
                            question=ans.question
                        )
                        max_points = aq.points
                    except AssessmentQuestion.DoesNotExist:
                        max_points = ans.question.points

                    if score_dec < 0:
                        raise ValidationError("Score cannot be negative.")
                    if score_dec > max_points:
                        raise ValidationError("Score cannot exceed question maximum points.")

            before_state = {
                'status': submission.status,
                'score': str(submission.score)
            }

            # Grade each answer
            for key, grade_data in grades_dict.items():
                try:
                    # Convert key to int if possible
                    lookup_id = int(key)
                except ValueError:
                    continue

                # Find StudentAnswer strictly by question_id
                ans = submission.answers.filter(question_id=lookup_id).first()
                if not ans:
                    continue

                score = Decimal(str(grade_data.get('score', ans.score)))
                is_correct = bool(grade_data.get('is_correct', ans.is_correct))
                teacher_notes = grade_data.get('teacher_notes', '')

                GradingService.manual_grade_answer(
                    student_answer=ans,
                    score=score,
                    is_correct=is_correct,
                    teacher_notes=teacher_notes,
                    graded_by=graded_by
                )

            submission.status = Submission.Status.GRADED
            submission.graded_by = graded_by
            submission.graded_at = timezone.now()
            submission.save()

            after_state = {
                'status': submission.status,
                'score': str(submission.score)
            }

            # Log to AuditService
            AuditService.log(
                actor=graded_by,
                action="submission.graded",
                entity=submission,
                before=before_state,
                after=after_state,
                request=request
            )

            return submission
