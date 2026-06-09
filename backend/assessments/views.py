from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from assessments.models import QuestionBank, Question, Assessment, Submission, StudentAnswer
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
from assessments.permissions import (
    IsAssessmentManagerOrAdmin,
    IsAssessmentParticipant,
    SubmissionPermission,
)
from assessments.services.assessment_service import AssessmentService
from accounts.permissions import has_org_permission


class QuestionBankViewSet(viewsets.ModelViewSet):
    """
    Exposes QuestionBank CRUD operations strictly for teachers and administrators.
    """
    permission_classes = [IsAssessmentManagerOrAdmin]
    serializer_class = QuestionBankSerializer

    def get_queryset(self):
        return QuestionBank.objects.filter(organization=self.request.organization)


class QuestionViewSet(viewsets.ModelViewSet):
    """
    Exposes Question CRUD operations strictly for teachers and administrators.
    """
    permission_classes = [IsAssessmentManagerOrAdmin]
    serializer_class = QuestionSerializer

    def get_queryset(self):
        return Question.objects.filter(question_bank__organization=self.request.organization)


class AssessmentViewSet(viewsets.ModelViewSet):
    """
    Exposes Assessments.
    - Managers/Admins can perform full CRUD and publish exams.
    - Students can list and retrieve published assessments.
    """
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'publish']:
            return [IsAssessmentManagerOrAdmin()]
        return [IsAssessmentParticipant()]

    def get_queryset(self):
        # Enforce eager loading and prefetching to prevent N+1 query patterns (ADR-012)
        qs = Assessment.objects.filter(organization=self.request.organization)\
            .select_related('session')\
            .prefetch_related('assessmentquestion_set', 'assessmentquestion_set__question')

        # Role-based visibility logic
        is_manager = (
            has_org_permission(self.request.user, self.request.organization, 'can_teach_class') or
            has_org_permission(self.request.user, self.request.organization, 'can_manage_members')
        )
        if not is_manager:
            qs = qs.filter(is_published=True)
        return qs

    def get_serializer_class(self):
        is_manager = (
            has_org_permission(self.request.user, self.request.organization, 'can_teach_class') or
            has_org_permission(self.request.user, self.request.organization, 'can_manage_members')
        )
        if is_manager:
            return AssessmentTeacherSerializer
        return AssessmentStudentSerializer

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        assessment = self.get_object()
        assessment.is_published = True
        assessment.save(update_fields=['is_published', 'updated_at'])
        return Response({'status': 'published'})

    @action(detail=True, methods=['post'], url_path='start')
    def start(self, request, pk=None):
        assessment = self.get_object()
        browser_info = request.META.get('HTTP_USER_AGENT', '')
        ip_address = request.META.get('REMOTE_ADDR')

        submission = AssessmentService.start_submission(
            assessment=assessment,
            student=request.user,
            browser_info=browser_info,
            ip_address=ip_address,
            request=request
        )
        serializer = SubmissionStudentSerializer(submission, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only views for Submissions. Contains custom action triggers for submit and manual grade.
    - Students are isolated to their own attempts.
    - Managers/Admins can view and grade all organization attempts.
    """
    permission_classes = [IsAssessmentParticipant, SubmissionPermission]

    def get_queryset(self):
        # Enforce query optimization prefetching bounds (ADR-012)
        qs = Submission.objects.filter(assessment__organization=self.request.organization)\
            .select_related('student', 'graded_by', 'assessment')\
            .prefetch_related('answers', 'answers__question')

        is_manager = (
            has_org_permission(self.request.user, self.request.organization, 'can_teach_class') or
            has_org_permission(self.request.user, self.request.organization, 'can_manage_members')
        )
        if not is_manager:
            qs = qs.filter(student=self.request.user)
        return qs

    def get_serializer_class(self):
        is_manager = (
            has_org_permission(self.request.user, self.request.organization, 'can_teach_class') or
            has_org_permission(self.request.user, self.request.organization, 'can_manage_members')
        )
        if is_manager:
            return SubmissionTeacherSerializer
        return SubmissionStudentSerializer

    @action(detail=True, methods=['post'], url_path='submit')
    def submit(self, request, pk=None):
        submission = self.get_object()
        finalized = AssessmentService.submit_assessment(submission, request=request)
        serializer = self.get_serializer(finalized)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='grade')
    def grade(self, request, pk=None):
        is_manager = (
            has_org_permission(self.request.user, self.request.organization, 'can_teach_class') or
            has_org_permission(self.request.user, self.request.organization, 'can_manage_members')
        )
        if not is_manager:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        submission = self.get_object()
        grades_dict = request.data.get('grades_dict', {})
        graded = AssessmentService.grade_submission(
            submission=submission,
            graded_by=request.user,
            grades_dict=grades_dict,
            request=request
        )
        serializer = self.get_serializer(graded)
        return Response(serializer.data)


class StudentAnswerViewSet(mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """
    Enables retrieving and saving student answers during active assessment attempts.
    """
    permission_classes = [IsAssessmentParticipant]

    def get_queryset(self):
        qs = StudentAnswer.objects.filter(submission__assessment__organization=self.request.organization)\
            .select_related('submission', 'submission__student', 'question')

        is_manager = (
            has_org_permission(self.request.user, self.request.organization, 'can_teach_class') or
            has_org_permission(self.request.user, self.request.organization, 'can_manage_members')
        )
        if not is_manager:
            qs = qs.filter(submission__student=self.request.user)
        return qs

    def get_serializer_class(self):
        is_manager = (
            has_org_permission(self.request.user, self.request.organization, 'can_teach_class') or
            has_org_permission(self.request.user, self.request.organization, 'can_manage_members')
        )
        if is_manager:
            return StudentAnswerTeacherSerializer
        return StudentAnswerSerializer

    def perform_update(self, serializer):
        instance = self.get_object()
        # Prevent updates if the submission is submitted or graded
        if instance.submission.status != Submission.Status.STARTED:
            raise ValidationError("Cannot modify answers of a submitted or graded assessment.")
        serializer.save()
