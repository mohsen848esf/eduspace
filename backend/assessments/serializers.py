from rest_framework import serializers
from assessments.models import QuestionBank, Question, Assessment, AssessmentQuestion, Submission, StudentAnswer, Assignment, AssignmentSubmission


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
                # Security hardening: verify question bank belongs to the active organization
                question = Question.objects.select_related('question_bank').filter(id=q_id).first()
                if question and question.question_bank.organization == assessment.organization:
                    AssessmentQuestion.objects.create(
                        assessment=assessment,
                        question_id=q_id,
                        order=q_data.get('order', 0),
                        points=q_data.get('points', '1.00')
                    )
                else:
                    raise serializers.ValidationError({"questions": f"Question {q_id} does not belong to your organization."})

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
    anti_cheat_token = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = ('id', 'assessment', 'student', 'student_username', 'status', 'started_at', 'submitted_at', 'score', 'tab_focus_losses', 'browser_info', 'ip_address', 'answers', 'anti_cheat_token')
        read_only_fields = ('id', 'assessment', 'student', 'student_username', 'status', 'started_at', 'submitted_at', 'score', 'tab_focus_losses', 'browser_info', 'ip_address', 'answers', 'anti_cheat_token')

    def get_anti_cheat_token(self, obj):
        from django.core.signing import Signer
        signer = Signer()
        return signer.sign(f"{obj.id}:{obj.tab_focus_losses}")


class SubmissionTeacherSerializer(serializers.ModelSerializer):
    assessment = AssessmentTeacherSerializer(read_only=True)
    answers = StudentAnswerTeacherSerializer(many=True, read_only=True)
    student_username = serializers.CharField(source='student.username', read_only=True)

    class Meta:
        model = Submission
        fields = ('id', 'assessment', 'student', 'student_username', 'status', 'started_at', 'submitted_at', 'score', 'graded_by', 'graded_at', 'tab_focus_losses', 'browser_info', 'ip_address', 'answers')
        read_only_fields = ('id', 'assessment', 'student', 'student_username', 'status', 'started_at', 'submitted_at', 'score', 'graded_by', 'graded_at', 'tab_focus_losses', 'browser_info', 'ip_address', 'answers')


class AssignmentSerializer(serializers.ModelSerializer):
    submissions_count = serializers.SerializerMethodField()
    graded_count = serializers.SerializerMethodField()
    class_name = serializers.CharField(source='academy_class.name', read_only=True)
    session_title = serializers.CharField(source='session.title', read_only=True)
    occurrence_title = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = ('id', 'academy_class', 'class_name', 'session', 'session_title', 'occurrence', 'occurrence_title', 'title', 'description', 'due_date', 'attachment', 'created_by', 'created_at', 'updated_at', 'submissions_count', 'graded_count')
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')

    def get_submissions_count(self, obj):
        return obj.submissions.count()

    def get_graded_count(self, obj):
        return obj.submissions.filter(status='graded').count()

    def get_occurrence_title(self, obj):
        if obj.occurrence:
            from django.utils import timezone
            return f"Session - {timezone.localtime(obj.occurrence.scheduled_start).strftime('%Y-%m-%d %H:%M')}"
        return ""

    def validate_academy_class(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            if value.course.organization != request.organization:
                raise serializers.ValidationError("Class does not belong to your organization.")
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)

    def validate(self, attrs):
        academy_class = attrs.get('academy_class', getattr(self.instance, 'academy_class', None))
        session = attrs.get('session', getattr(self.instance, 'session', None))
        occurrence = attrs.get('occurrence', getattr(self.instance, 'occurrence', None))
        
        if session and occurrence:
            raise serializers.ValidationError("An assignment cannot be linked to both a session and an occurrence.")
            
        if session and academy_class:
            if session.academy_class != academy_class:
                raise serializers.ValidationError({"session": "The selected session does not belong to this class."})
                
        if occurrence and academy_class:
            if occurrence.academy_class != academy_class:
                raise serializers.ValidationError({"occurrence": "The selected occurrence does not belong to this class."})
        return attrs


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_full_name = serializers.CharField(source='student.full_name', read_only=True)
    assignment_title = serializers.CharField(source='assignment.title', read_only=True)

    class Meta:
        model = AssignmentSubmission
        fields = ('id', 'assignment', 'assignment_title', 'student', 'student_username', 'student_full_name', 'status', 'submitted_at', 'submission_file', 'submission_text', 'grade', 'feedback', 'graded_by', 'graded_at')
        read_only_fields = ('id', 'student', 'status', 'submitted_at', 'graded_by', 'graded_at')

    def validate(self, attrs):
        request = self.context.get('request')
        org = getattr(request, 'organization', None) if request else None

        if org:
            assignment = attrs.get('assignment', self.instance.assignment if self.instance else None)
            if assignment:
                if assignment.organization != org:
                    raise serializers.ValidationError({"assignment": "Assignment does not belong to this organization."})

                student = request.user if request else None
                if student:
                    from accounts.permissions import has_org_permission
                    is_staff_or_teacher = (
                        student.is_superuser or
                        has_org_permission(student, org, 'can_teach_class') or
                        has_org_permission(student, org, 'can_manage_members')
                    )
                    if not is_staff_or_teacher:
                        from accounts.models import Enrollment
                        if not Enrollment.objects.filter(
                            academy_class=assignment.academy_class,
                            student=student,
                            is_active=True
                        ).exists():
                            raise serializers.ValidationError({"student": "You are not enrolled in the class for this assignment."})
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['student'] = request.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if 'grade' in validated_data or 'feedback' in validated_data:
            validated_data['status'] = 'graded'
            if request and request.user:
                validated_data['graded_by'] = request.user
                import django.utils.timezone as timezone
                validated_data['graded_at'] = timezone.now()
        return super().update(instance, validated_data)
