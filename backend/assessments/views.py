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
from assessments.services.anti_cheat_service import AntiCheatService
from accounts.services.audit_service import AuditService
from accounts.permissions import has_org_permission


class QuestionBankViewSet(viewsets.ModelViewSet):
    """
    Exposes QuestionBank CRUD operations strictly for teachers and administrators.
    """
    permission_classes = [IsAssessmentManagerOrAdmin]
    serializer_class = QuestionBankSerializer

    def get_queryset(self):
        return QuestionBank.objects.filter(organization=self.request.organization)

    def perform_create(self, serializer):
        instance = serializer.save()
        AuditService.log(
            actor=self.request.user,
            action="question_bank.created",
            entity=instance,
            after=serializer.data,
            request=self.request
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        old_db_instance = self.get_queryset().get(pk=instance.pk)
        before_state = self.get_serializer(old_db_instance).data

        instance = serializer.save()
        after_state = self.get_serializer(instance).data

        AuditService.log(
            actor=self.request.user,
            action="question_bank.updated",
            entity=instance,
            before=before_state,
            after=after_state,
            request=self.request
        )

    def perform_destroy(self, instance):
        before_state = self.get_serializer(instance).data
        AuditService.log(
            actor=self.request.user,
            action="question_bank.deleted",
            entity=instance,
            before=before_state,
            request=self.request
        )
        instance.delete()


class QuestionViewSet(viewsets.ModelViewSet):
    """
    Exposes Question CRUD operations strictly for teachers and administrators.
    """
    permission_classes = [IsAssessmentManagerOrAdmin]
    serializer_class = QuestionSerializer

    def get_queryset(self):
        return Question.objects.filter(question_bank__organization=self.request.organization)

    def perform_create(self, serializer):
        instance = serializer.save()
        AuditService.log(
            actor=self.request.user,
            action="question.created",
            entity=instance,
            after=serializer.data,
            request=self.request
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        old_db_instance = self.get_queryset().get(pk=instance.pk)
        before_state = self.get_serializer(old_db_instance).data

        instance = serializer.save()
        after_state = self.get_serializer(instance).data

        # Determine if it was archived, restored, or just updated
        action = "question.updated"
        if not old_db_instance.is_active and instance.is_active:
            action = "question.restored"
        elif old_db_instance.is_active and not instance.is_active:
            action = "question.archived"

        AuditService.log(
            actor=self.request.user,
            action=action,
            entity=instance,
            before=before_state,
            after=after_state,
            request=self.request
        )

    def perform_destroy(self, instance):
        before_state = self.get_serializer(instance).data
        AuditService.log(
            actor=self.request.user,
            action="question.deleted",
            entity=instance,
            before=before_state,
            request=self.request
        )
        instance.delete()


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

    def perform_create(self, serializer):
        instance = serializer.save()
        AuditService.log(
            actor=self.request.user,
            action="assessment.created",
            entity=instance,
            after=serializer.data,
            request=self.request
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        old_db_instance = self.get_queryset().get(pk=instance.pk)
        before_state = self.get_serializer(old_db_instance).data

        instance = serializer.save()
        after_state = self.get_serializer(instance).data

        AuditService.log(
            actor=self.request.user,
            action="assessment.updated",
            entity=instance,
            before=before_state,
            after=after_state,
            request=self.request
        )

    def perform_destroy(self, instance):
        before_state = self.get_serializer(instance).data
        AuditService.log(
            actor=self.request.user,
            action="assessment.deleted",
            entity=instance,
            before=before_state,
            request=self.request
        )
        instance.delete()

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        assessment = self.get_object()
        was_published = assessment.is_published
        assessment.is_published = True
        assessment.save(update_fields=['is_published', 'updated_at'])
        
        if not was_published:
            AuditService.log(
                actor=request.user,
                action="assessment.published",
                entity=assessment,
                before={"is_published": False},
                after={"is_published": True},
                request=request
            )
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

    @action(detail=True, methods=['post'], url_path='record-tab-loss')
    def record_tab_loss(self, request, pk=None):
        from django.db import transaction
        with transaction.atomic():
            submission = Submission.objects.select_for_update().get(pk=self.get_object().pk)
            if submission.status != Submission.Status.STARTED:
                return Response(
                    {"error": "Submission is already submitted or graded."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            current_losses = AntiCheatService.record_tab_loss(
                submission=submission,
                actor=request.user,
                request=request
            )
            anomaly = AntiCheatService.check_anomalies(submission)
            return Response({
                "tab_focus_losses": current_losses,
                "anomaly_detected": anomaly["is_flagged"]
            })

    @action(detail=True, methods=['post'], url_path='update-telemetry')
    def update_telemetry(self, request, pk=None):
        from django.db import transaction
        with transaction.atomic():
            submission = Submission.objects.select_for_update().get(pk=self.get_object().pk)
            if submission.status != Submission.Status.STARTED:
                return Response(
                    {"error": "Submission is already submitted or graded."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            ip_address = request.data.get('ip_address') or request.META.get('REMOTE_ADDR')
            browser_info = request.data.get('browser_info') or request.META.get('HTTP_USER_AGENT', '')
            AntiCheatService.update_telemetry(
                submission=submission,
                ip_address=ip_address,
                browser_info=browser_info
            )
            submission.refresh_from_db()
            serializer = self.get_serializer(submission)
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
        from django.db import transaction
        with transaction.atomic():
            locked_submission = (
                Submission.objects
                .select_for_update()
                .get(pk=instance.submission_id)
            )
            if locked_submission.status != Submission.Status.STARTED:
                raise ValidationError("Cannot modify answers of a submitted or graded assessment.")
            serializer.save()
