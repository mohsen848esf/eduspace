from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db import models
from .models import User
from .serializers import RegisterSerializer, UserSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    if user:
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data.get('refresh')
        token = RefreshToken(refresh_token)
        token.blacklist()
    except Exception:
        pass
    return Response({'message': 'Logged out'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_users(request):
    q = request.query_params.get('q', '').strip()
    if len(q) < 2:
        return Response([])
    
    users = User.objects.filter(
        models.Q(username__icontains=q) | 
        models.Q(full_name__icontains=q)
    ).exclude(id=request.user.id)[:10]
    
    return Response(UserSerializer(users, many=True).data)


# ---------------------------------------------------------------------------
# CRM & Financial ViewSets
# ---------------------------------------------------------------------------
from rest_framework import viewsets
from rest_framework.decorators import action
from .permissions import HasOrgPermission, has_org_permission
from .models import Course, AcademyClass, Enrollment, TuitionInvoice, ExpenseItem, Session, Attendance
from .serializers import (
    CourseSerializer, AcademyClassSerializer, EnrollmentSerializer,
    TuitionInvoiceSerializer, ExpenseItemSerializer, SessionSerializer, AttendanceSerializer
)
from accounts.services.session_service import SessionService
from accounts.services.attendance_service import AttendanceService
from accounts.services.audit_service import AuditService
from django.core.exceptions import ValidationError

class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    permission_classes = [HasOrgPermission]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.required_org_permission = 'can_view_dashboard'
        else:
            self.required_org_permission = 'can_manage_members'
        return super().get_permissions()

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if not org:
            return Course.objects.none()
        queryset = Course.objects.select_related('created_by').filter(organization=org)
        include_archived = self.request.query_params.get('include_archived', '').lower() == 'true'
        if not include_archived:
            queryset = queryset.filter(is_active=True)
        return queryset


class AcademyClassViewSet(viewsets.ModelViewSet):
    serializer_class = AcademyClassSerializer
    permission_classes = [HasOrgPermission]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.required_org_permission = 'can_view_dashboard'
        else:
            self.required_org_permission = 'can_manage_members'
        return super().get_permissions()

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if not org:
            return AcademyClass.objects.none()
        queryset = AcademyClass.objects.select_related('course', 'teacher', 'created_by', 'room').prefetch_related('sessions').filter(course__organization=org)
        include_archived = self.request.query_params.get('include_archived', '').lower() == 'true'
        if not include_archived:
            queryset = queryset.filter(is_active=True)
        return queryset


class EnrollmentViewSet(viewsets.ModelViewSet):
    serializer_class = EnrollmentSerializer
    permission_classes = [HasOrgPermission]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.required_org_permission = 'can_view_dashboard'
        else:
            self.required_org_permission = 'can_manage_members'
        return super().get_permissions()

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if not org:
            return Enrollment.objects.none()
        
        queryset = Enrollment.objects.select_related('student', 'academy_class__course', 'enrolled_by').filter(academy_class__course__organization=org)
        
        # Students should only see their own enrollments, teachers/admins can see all
        if not has_org_permission(self.request.user, org, 'can_manage_members') and \
           not has_org_permission(self.request.user, org, 'can_teach_class'):
            queryset = queryset.filter(student=self.request.user)
            
        include_archived = self.request.query_params.get('include_archived', '').lower() == 'true'
        if not include_archived:
            queryset = queryset.filter(is_active=True)
            
        return queryset


class TuitionInvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = TuitionInvoiceSerializer
    permission_classes = [HasOrgPermission]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.required_org_permission = 'can_view_dashboard'
        else:
            self.required_org_permission = 'can_manage_financials'
        return super().get_permissions()

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if not org:
            return TuitionInvoice.objects.none()
            
        queryset = TuitionInvoice.objects.select_related('student', 'academy_class__course', 'issued_by').filter(organization=org)
        
        # Isolation: Students only see their own invoices, financials viewers see all
        if not has_org_permission(self.request.user, org, 'can_view_financials'):
            queryset = queryset.filter(student=self.request.user)
            
        return queryset


class ExpenseItemViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseItemSerializer
    permission_classes = [HasOrgPermission]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.required_org_permission = 'can_view_financials'
        else:
            self.required_org_permission = 'can_manage_financials'
        return super().get_permissions()

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if not org:
            return ExpenseItem.objects.none()
            
        # Only users with can_view_financials can view expenses
        if not has_org_permission(self.request.user, org, 'can_view_financials'):
            return ExpenseItem.objects.none()
            
        return ExpenseItem.objects.select_related('recipient', 'approved_by').filter(organization=org)


class SessionViewSet(viewsets.ModelViewSet):
    serializer_class = SessionSerializer
    permission_classes = [HasOrgPermission]

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'attendance', 'get_student_attendance']:
            self.required_org_permission = 'can_view_sessions'
        else:
            self.required_org_permission = 'can_manage_sessions'
        return super().get_permissions()

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if not org:
            return Session.objects.none()

        queryset = Session.objects.select_related('academy_class__course', 'host', 'active_room').filter(organization=org)

        # Enforce dynamic role isolation
        if not self.request.user.is_superuser and not has_org_permission(self.request.user, org, 'can_manage_sessions'):
            # If teacher, show sessions hosted by them or classes they teach
            if has_org_permission(self.request.user, org, 'can_teach_class'):
                queryset = queryset.filter(
                    models.Q(host=self.request.user) | models.Q(academy_class__teacher=self.request.user)
                )
            # Otherwise (student or guest), show only sessions from their enrolled classes
            else:
                queryset = queryset.filter(academy_class__enrollments__student=self.request.user, academy_class__enrollments__is_active=True)

        class_id = self.request.query_params.get('class_id')
        if class_id:
            queryset = queryset.filter(academy_class_id=class_id)

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.distinct()

    @action(detail=True, methods=['POST'])
    def start(self, request, pk=None):
        session = self.get_object()
        try:
            session = SessionService.start_session(session.id, actor=request.user)
        except ValidationError as e:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            raise DRFValidationError(detail=e.message_dict if hasattr(e, 'message_dict') else e.messages)
        return Response(SessionSerializer(session).data)

    @action(detail=True, methods=['POST'])
    def complete(self, request, pk=None):
        session = self.get_object()
        try:
            session = SessionService.complete_session(session.id, actor=request.user)
        except ValidationError as e:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            raise DRFValidationError(detail=e.message_dict if hasattr(e, 'message_dict') else e.messages)
        return Response(SessionSerializer(session).data)

    @action(detail=True, methods=['POST'])
    def cancel(self, request, pk=None):
        session = self.get_object()
        try:
            session = SessionService.cancel_session(session.id, actor=request.user)
        except ValidationError as e:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            raise DRFValidationError(detail=e.message_dict if hasattr(e, 'message_dict') else e.messages)
        return Response(SessionSerializer(session).data)

    @action(detail=True, methods=['GET'])
    def attendance(self, request, pk=None):
        session = self.get_object()
        queryset = Attendance.objects.filter(session=session).select_related('student')
        
        # Isolation: Students can only view their own attendance record
        org = getattr(request, 'organization', None)
        if org and not has_org_permission(request.user, org, 'can_view_attendance'):
            queryset = queryset.filter(student=request.user)
            
        serializer = AttendanceSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['PATCH'], url_path='attendance/(?P<student_id>[^/.]+)')
    def update_student_attendance(self, request, pk=None, student_id=None):
        session = self.get_object()
        try:
            att = Attendance.objects.get(session=session, student_id=student_id)
        except Attendance.DoesNotExist:
            return Response({'error': 'Attendance record not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AttendanceSerializer(att, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            
            # Log audit override event
            org = getattr(request, 'organization', None)
            AuditService.log(
                actor=request.user,
                action='attendance.override',
                entity=att.session,
                before={'status': att.status, 'note': att.note},
                after={'status': serializer.validated_data.get('status', att.status), 'note': serializer.validated_data.get('note', att.note)},
                organization=org
            )
            
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['POST'], url_path='attendance/bulk')
    def bulk_update_attendance(self, request, pk=None):
        session = self.get_object()
        records_data = request.data.get('records', [])
        if not isinstance(records_data, list):
            return Response({'error': 'Invalid bulk records payload format (must be list of objects)'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        updated_count = 0
        with transaction.atomic():
            attendances = {
                a.student_id: a for a in Attendance.objects.filter(session=session)
            }
            
            to_update = []
            before_states = {}
            after_states = {}
            for item in records_data:
                sid = item.get('student_id')
                if sid in attendances:
                    att = attendances[sid]
                    before_states[sid] = {'status': att.status, 'note': att.note}
                    if 'status' in item:
                        att.status = item['status']
                    if 'note' in item:
                        att.note = item.get('note', '')
                    to_update.append(att)
                    after_states[sid] = {'status': att.status, 'note': att.note}

            if to_update:
                Attendance.objects.bulk_update(to_update, fields=['status', 'note'])
                updated_count = len(to_update)

            # Log audit bulk override event
            org = getattr(request, 'organization', None)
            AuditService.log(
                actor=request.user,
                action='attendance.bulk_override',
                entity=session,
                before=before_states,
                after=after_states,
                organization=org
            )

        return Response({'message': f'Bulk updated {updated_count} records', 'updated': updated_count})


class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [HasOrgPermission]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.required_org_permission = 'can_view_attendance'
        else:
            self.required_org_permission = 'can_manage_attendance'
        return super().get_permissions()

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if not org:
            return Attendance.objects.none()

        queryset = Attendance.objects.filter(session__organization=org).select_related('session', 'student')

        # Isolation: Students only see their own attendance logs
        if not has_org_permission(self.request.user, org, 'can_view_attendance'):
            queryset = queryset.filter(student=self.request.user)

        session_id = self.request.query_params.get('session_id')
        if session_id:
            queryset = queryset.filter(session_id=session_id)

        return queryset

