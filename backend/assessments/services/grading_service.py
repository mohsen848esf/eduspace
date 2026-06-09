from decimal import Decimal
from django.core.exceptions import ValidationError
from assessments.models import StudentAnswer, Submission, AssessmentQuestion, Question

class GradingService:
    @staticmethod
    def grade_answer(student_answer: StudentAnswer) -> tuple[Decimal, bool]:
        """
        Grades a single student answer dynamically.
        Returns a tuple: (score, is_correct)
        """
        question = student_answer.question
        submission = student_answer.submission
        assessment = submission.assessment
        
        # 1. Determine points for this question (check AssessmentQuestion override first)
        try:
            aq = AssessmentQuestion.objects.get(assessment=assessment, question=question)
            points = aq.points
        except AssessmentQuestion.DoesNotExist:
            points = question.points

        # 2. Grade based on question type
        q_type = question.question_type
        
        if q_type == Question.QuestionType.SINGLE_CHOICE:
            # correct_answer is a list, selected_options is a list
            correct = question.correct_answer
            selected = student_answer.selected_options
            if selected is not None and isinstance(selected, list) and isinstance(correct, list):
                if set(selected) == set(correct):
                    return points, True
            return Decimal("0.00"), False

        elif q_type == Question.QuestionType.MULTIPLE_CHOICE:
            correct = question.correct_answer
            selected = student_answer.selected_options
            if selected is not None and isinstance(selected, list) and isinstance(correct, list):
                if set(selected) == set(correct):
                    return points, True
            return Decimal("0.00"), False

        elif q_type == Question.QuestionType.TEXT:
            # check student_answer.text_answer
            correct = question.correct_answer
            selected = student_answer.text_answer
            if selected is not None:
                selected_clean = selected.strip().lower()
                if isinstance(correct, list):
                    correct_cleans = [str(ans).strip().lower() for ans in correct]
                    if selected_clean in correct_cleans:
                        return points, True
                elif isinstance(correct, dict):
                    # check for common formats like {"text": "value"}
                    correct_val = correct.get("text", "")
                    if correct_val and selected_clean == str(correct_val).strip().lower():
                        return points, True
                else:
                    if selected_clean == str(correct).strip().lower():
                        return points, True
            return Decimal("0.00"), False

        elif q_type == Question.QuestionType.CODE:
            # Code questions are not auto-gradable by default, return 0.00 and False
            return Decimal("0.00"), False

        return Decimal("0.00"), False

    @staticmethod
    def auto_grade_submission(submission: Submission) -> None:
        """
        Iterates over all answers in a submission and auto-grades the ones that are auto-gradable.
        """
        answers = submission.answers.select_related('question').all()
        for ans in answers:
            score, is_correct = GradingService.grade_answer(ans)
            ans.score = score
            ans.is_correct = is_correct
            ans.save()
        
        # Recalculate submission score
        GradingService.recalculate_submission_score(submission)

    @staticmethod
    def manual_grade_answer(student_answer: StudentAnswer, score: Decimal, is_correct: bool, teacher_notes: str = "", graded_by=None) -> StudentAnswer:
        """
        Allows a teacher to grade a student's answer manually (usually for code/text questions, or overriding choice questions).
        """
        student_answer.score = score
        student_answer.is_correct = is_correct
        if teacher_notes:
            student_answer.teacher_notes = teacher_notes
        student_answer.save()

        # Recalculate submission score
        GradingService.recalculate_submission_score(student_answer.submission)
        return student_answer

    @staticmethod
    def recalculate_submission_score(submission: Submission) -> Decimal:
        """
        Recalculates the total score of the submission by summing all student answers.
        """
        total_score = Decimal("0.00")
        for ans in submission.answers.all():
            total_score += ans.score
        
        submission.score = total_score
        submission.save()
        return total_score
