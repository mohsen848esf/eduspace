from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

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
from .permissions import HasOrgPermission, has_org_permission
from .models import Course, AcademyClass, Enrollment, TuitionInvoice, ExpenseItem
from .serializers import (
    CourseSerializer, AcademyClassSerializer, EnrollmentSerializer,
    TuitionInvoiceSerializer, ExpenseItemSerializer
)

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
        queryset = AcademyClass.objects.select_related('course', 'teacher', 'created_by').filter(course__organization=org)
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


from rest_framework.decorators import action
from django.conf import settings
from .models import Session, Attendance
from .serializers import SessionSerializer, AttendanceSerializer

class SessionViewSet(viewsets.ModelViewSet):
    serializer_class = SessionSerializer
    permission_classes = [HasOrgPermission]

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'attendance']:
            self.required_org_permission = 'can_view_dashboard'
        else:
            self.required_org_permission = 'can_manage_sessions'
        return super().get_permissions()

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if not org:
            return Session.objects.none()
        
        queryset = Session.objects.select_related('academy_class', 'host', 'created_by').filter(organization=org)
        
        class_id = self.request.query_params.get('class_id')
        if class_id:
            queryset = queryset.filter(academy_class_id=class_id)
            
        return queryset

    def perform_create(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != Session.Status.SCHEDULED:
            return Response({'error': 'Only scheduled sessions can be deleted.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['POST'])
    def start(self, request, pk=None):
        session = self.get_object()
        if session.status != Session.Status.SCHEDULED:
            return Response({'error': 'Only scheduled sessions can be started.'}, status=status.HTTP_400_BAD_REQUEST)
        
        from rooms.views import generate_room_code, generate_livekit_token
        from rooms.models import Room, RoomParticipant

        room_code = generate_room_code()
        while Room.objects.filter(room_code=room_code).exists():
            room_code = generate_room_code()

        room = Room.objects.create(
            name=session.title,
            room_code=room_code,
            host=session.host,
            max_participants=20,
            is_recorded=False,
            session=session,
            organization=session.get_organization(),
            meeting_type='class_session'
        )

        RoomParticipant.objects.create(
            room=room,
            user=session.host,
            role=RoomParticipant.Role.HOST
        )

        session.start_live()

        token = generate_livekit_token(room_code, session.host, is_host=True)

        return Response({
            'message': 'Session started successfully.',
            'room_code': room.room_code,
            'token': token,
            'livekit_url': settings.LIVEKIT_WS_URL if hasattr(settings, 'LIVEKIT_WS_URL') else 'ws://localhost:7880'
        })

    @action(detail=True, methods=['POST'])
    def complete(self, request, pk=None):
        session = self.get_object()
        if session.status != Session.Status.LIVE:
            return Response({'error': 'Only live sessions can be completed.'}, status=status.HTTP_400_BAD_REQUEST)
        
        session.complete()
        
        room = getattr(session, 'room', None)
        if room:
            room.status = room.Status.ENDED
            room.ended_at = timezone.now()
            room.save()
            from rooms.models import RoomParticipant
            RoomParticipant.objects.filter(room=room).update(is_active=False)

        return Response({'message': 'Session completed successfully.'})

    @action(detail=True, methods=['POST'])
    def cancel(self, request, pk=None):
        session = self.get_object()
        if session.status != Session.Status.SCHEDULED:
            return Response({'error': 'Only scheduled sessions can be cancelled.'}, status=status.HTTP_400_BAD_REQUEST)
        
        session.status = Session.Status.CANCELLED
        session.save()
        return Response({'message': 'Session cancelled successfully.'})

    @action(detail=True, methods=['GET'], url_path='attendance')
    def attendance(self, request, pk=None):
        session = self.get_object()
        records = session.attendance_records.select_related('student')
        serializer = AttendanceSerializer(records, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['PATCH'], url_path='attendance/(?P<student_id>[^/.]+)')
    def update_student_attendance(self, request, pk=None, student_id=None):
        session = self.get_object()
        try:
            attendance = session.attendance_records.get(student_id=student_id)
        except Attendance.DoesNotExist:
            return Response({'error': 'Attendance record not found for student.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AttendanceSerializer(attendance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['POST'], url_path='attendance/bulk-update')
    def bulk_update_attendance(self, request, pk=None):
        session = self.get_object()
        updates = request.data.get('updates', [])
        if not isinstance(updates, list):
            return Response({'error': 'Updates must be a list.'}, status=status.HTTP_400_BAD_REQUEST)

        updated_records = []
        for item in updates:
            student_id = item.get('student_id')
            status_val = item.get('status')
            note = item.get('note', '')

            if not student_id or not status_val:
                continue

            try:
                attendance = session.attendance_records.get(student_id=student_id)
                attendance.status = status_val
                if 'note' in item:
                    attendance.note = note
                attendance.save()
                updated_records.append(attendance)
            except Attendance.DoesNotExist:
                continue

        serializer = AttendanceSerializer(updated_records, many=True)
        return Response(serializer.data)

