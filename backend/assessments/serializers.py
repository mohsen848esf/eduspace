from rest_framework import serializers
from assessments.models import QuestionBank, Question, Assessment, AssessmentQuestion, Submission, StudentAnswer


class QuestionBankSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionBank
        fields = ('id', 'title', 'description', 'created_by', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ('id', 'question_bank', 'text', 'question_type', 'options', 'correct_answer', 'points', 'is_active', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_question_bank(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            if value.organization != request.organization:
                raise serializers.ValidationError("Question bank does not belong to your organization.")
        return value


class QuestionStudentSerializer(serializers.ModelSerializer):
    """
    Excludes the correct_answer field to prevent cheating.
    """
    class Meta:
        model = Question
        fields = ('id', 'question_bank', 'text', 'question_type', 'options', 'points', 'is_active')
        read_only_fields = ('id', 'question_bank', 'text', 'question_type', 'options', 'points', 'is_active')


class AssessmentQuestionSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)

    class Meta:
        model = AssessmentQuestion
        fields = ('id', 'question', 'order', 'points')


class AssessmentQuestionStudentSerializer(serializers.ModelSerializer):
    question = QuestionStudentSerializer(read_only=True)

    class Meta:
        model = AssessmentQuestion
        fields = ('id', 'question', 'order', 'points')


class AssessmentTeacherSerializer(serializers.ModelSerializer):
    questions = AssessmentQuestionSerializer(source='assessmentquestion_set', many=True, read_only=True)
    session_title = serializers.CharField(source='session.title', read_only=True)

    class Meta:
        model = Assessment
        fields = ('id', 'session', 'session_title', 'title', 'description', 'questions', 'duration_minutes', 'passing_score', 'is_published', 'created_by', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')

    def create(self, validated_data):
        from django.db import transaction
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user

        questions_data = self.initial_data.get('questions', [])
        with transaction.atomic():
            assessment = super().create(validated_data)
            self._save_questions(assessment, questions_data)
            return assessment

    def update(self, instance, validated_data):
        from django.db import transaction
        questions_data = self.initial_data.get('questions')
        with transaction.atomic():
            assessment = super().update(instance, validated_data)
            if questions_data is not None:
                self._save_questions(assessment, questions_data)
            return assessment

    def _save_questions(self, assessment, questions_data):
        # Remove old questions
        assessment.assessmentquestion_set.all().delete()
        # Create new ones
        for q_data in questions_data:
            q_id = q_data.get('question_id') or q_data.get('question', {}).get('id')
            if q_id:
                AssessmentQuestion.objects.create(
                    assessment=assessment,
                    question_id=q_id,
                    order=q_data.get('order', 0),
                    points=q_data.get('points', '1.00')
                )

    def validate_session(self, value):
        request = self.context.get('request')
        if value and request and hasattr(request, 'organization'):
            if value.organization != request.organization:
                raise serializers.ValidationError("Session does not belong to your organization.")
        return value


class AssessmentStudentSerializer(serializers.ModelSerializer):
    questions = AssessmentQuestionStudentSerializer(source='assessmentquestion_set', many=True, read_only=True)
    session_title = serializers.CharField(source='session.title', read_only=True)

    class Meta:
        model = Assessment
        fields = ('id', 'session', 'session_title', 'title', 'description', 'questions', 'duration_minutes', 'passing_score', 'is_published')
        read_only_fields = ('id', 'session', 'session_title', 'title', 'description', 'questions', 'duration_minutes', 'passing_score', 'is_published')


class StudentAnswerSerializer(serializers.ModelSerializer):
    """
    Used by students to view or update their answers.
    Score, correctness, and teacher feedback notes are read-only.
    """
    class Meta:
        model = StudentAnswer
        fields = ('id', 'submission', 'question', 'selected_options', 'text_answer', 'score', 'is_correct')
        read_only_fields = ('id', 'submission', 'question', 'score', 'is_correct')


class StudentAnswerTeacherSerializer(serializers.ModelSerializer):
    """
    Used by teachers to grade student answers manually.
    Allows editing score, is_correct, and teacher_notes.
    """
    class Meta:
        model = StudentAnswer
        fields = ('id', 'submission', 'question', 'selected_options', 'text_answer', 'score', 'is_correct', 'teacher_notes')
        read_only_fields = ('id', 'submission', 'question')


class SubmissionStudentSerializer(serializers.ModelSerializer):
    assessment = AssessmentStudentSerializer(read_only=True)
    answers = StudentAnswerSerializer(many=True, read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)

    class Meta:
        model = Submission
        fields = ('id', 'assessment', 'student', 'student_username', 'status', 'started_at', 'submitted_at', 'score', 'tab_focus_losses', 'browser_info', 'ip_address', 'answers')
        read_only_fields = ('id', 'assessment', 'student', 'student_username', 'status', 'started_at', 'submitted_at', 'score', 'tab_focus_losses', 'browser_info', 'ip_address', 'answers')


class SubmissionTeacherSerializer(serializers.ModelSerializer):
    assessment = AssessmentTeacherSerializer(read_only=True)
    answers = StudentAnswerTeacherSerializer(many=True, read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)

    class Meta:
        model = Submission
        fields = ('id', 'assessment', 'student', 'student_username', 'status', 'started_at', 'submitted_at', 'score', 'graded_by', 'graded_at', 'tab_focus_losses', 'browser_info', 'ip_address', 'answers')
        read_only_fields = ('id', 'assessment', 'student', 'student_username', 'status', 'started_at', 'submitted_at', 'score', 'graded_by', 'graded_at', 'tab_focus_losses', 'browser_info', 'ip_address', 'answers')
