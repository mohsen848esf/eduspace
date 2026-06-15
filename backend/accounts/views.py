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
        
        # Onboarding: Automatically assign new users to the default organization
        from .models import Organization, Role, OrgMember
        default_org = Organization.objects.filter(slug='default-academy').first()
        if default_org:
            student_role = Role.objects.filter(name='Student', organization__isnull=True).first()
            if student_role:
                OrgMember.objects.get_or_create(
                    organization=default_org,
                    user=user,
                    defaults={'role': student_role}
                )
                
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


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == 'PATCH':
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(UserSerializer(request.user, context={'request': request}).data)


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
    role_filter = request.query_params.get('role', '').strip().lower()
    if len(q) < 2:
        return Response([])
    
    from accounts.permissions import resolve_organization
    from accounts.models import OrgMember
    
    org = resolve_organization(request)
    if org:
        members = OrgMember.objects.filter(
            organization=org,
            user__is_active=True
        ).select_related('user', 'role').prefetch_related(
            'user__org_memberships__organization',
            'user__org_memberships__role'
        )
        
        if q:
            members = members.filter(
                models.Q(user__username__icontains=q) | 
                models.Q(user__full_name__icontains=q)
            )
            
        if role_filter:
            if role_filter == 'teacher':
                members = members.filter(role__name__in=['Teacher', 'Admin'])
            elif role_filter == 'student':
                members = members.filter(role__name='Student')
            elif role_filter == 'admin':
                members = members.filter(role__name='Admin')
                
        results = []
        for m in members[:10]:
            user_data = UserSerializer(m.user, context={'request': request}).data
            user_data['role'] = m.role.name.lower() if m.role else 'student'
            results.append(user_data)
            
        return Response(results)
    users = User.objects.filter(
        models.Q(username__icontains=q) | 
        models.Q(full_name__icontains=q)
    ).exclude(id=request.user.id).prefetch_related(
        'org_memberships__organization',
        'org_memberships__role'
    )
    
    results = []
    for u in users[:10]:
        user_data = UserSerializer(u, context={'request': request}).data
        results.append(user_data)
        
    return Response(results)
from rest_framework.pagination import PageNumberPagination
from collections import OrderedDict

class GlobalSearchPagination(PageNumberPagination):
    page_size = 5
    page_size_query_param = 'page_size'
    max_page_size = 50

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_search(request):
    q = request.query_params.get('q', '').strip()
    if len(q) < 2:
        return Response({
            "students": [],
            "teachers": [],
            "courses": [],
            "classes": [],
            "sessions": [],
            "assessments": [],
            "invoices": []
        })

    from accounts.permissions import resolve_organization, has_org_permission
    from accounts.models import OrgMember, Course, AcademyClass, Session, TuitionInvoice
    from assessments.models import Assessment
    
    org = resolve_organization(request)
    if not org:
        return Response({
            "students": [],
            "teachers": [],
            "courses": [],
            "classes": [],
            "sessions": [],
            "assessments": [],
            "invoices": []
        })

    # Enforce organization membership/permission checks
    if not request.user.is_superuser and not has_org_permission(request.user, org, 'can_view_dashboard'):
        return Response({'error': 'Required permission missing: can_view_dashboard'}, status=status.HTTP_403_FORBIDDEN)

    # 1. Base Querysets
    members = OrgMember.objects.filter(
        organization=org,
        user__is_active=True
    ).select_related('user', 'role').filter(
        models.Q(user__username__icontains=q) | models.Q(user__full_name__icontains=q)
    )
    students_query = members.filter(models.Q(role__isnull=True) | models.Q(role__name='Student'))
    teachers_query = members.filter(role__name__in=['Teacher', 'Admin'])

    courses_query = Course.objects.filter(organization=org, is_active=True).filter(
        models.Q(title__icontains=q) | models.Q(code__icontains=q)
    )

    classes_query = AcademyClass.objects.filter(course__organization=org, is_active=True).select_related('course')
    if not request.user.is_superuser and not has_org_permission(request.user, org, 'can_manage_members'):
        if has_org_permission(request.user, org, 'can_teach_class'):
            classes_query = classes_query.filter(teacher=request.user)
        else:
            classes_query = classes_query.filter(enrollments__student=request.user)
    classes_query = classes_query.filter(name__icontains=q)

    sessions_query = Session.objects.filter(organization=org).select_related('academy_class__course', 'active_room')
    if not request.user.is_superuser and not has_org_permission(request.user, org, 'can_manage_sessions'):
        if has_org_permission(request.user, org, 'can_teach_class'):
            sessions_query = sessions_query.filter(
                models.Q(host=request.user) | models.Q(academy_class__teacher=request.user)
            )
        else:
            sessions_query = sessions_query.filter(
                academy_class__enrollments__student=request.user,
                academy_class__enrollments__is_active=True
            )
    sessions_query = sessions_query.filter(title__icontains=q)

    is_manager = (
        has_org_permission(request.user, org, 'can_teach_class') or
        has_org_permission(request.user, org, 'can_manage_members')
    )
    assessments_query = Assessment.objects.filter(organization=org)
    if not is_manager:
        assessments_query = assessments_query.filter(is_published=True)
    assessments_query = assessments_query.filter(models.Q(title__icontains=q) | models.Q(description__icontains=q))

    invoices_query = TuitionInvoice.objects.filter(organization=org).select_related('student')
    if not has_org_permission(request.user, org, 'can_view_financials'):
        invoices_query = invoices_query.filter(student=request.user)
    invoices_query = invoices_query.filter(
        models.Q(invoice_number__icontains=q) |
        models.Q(student__username__icontains=q) |
        models.Q(student__full_name__icontains=q)
    )

    # 2. Page Parameters Parsing
    paginator = GlobalSearchPagination()
    try:
        page = int(request.query_params.get(paginator.page_query_param, 1))
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    try:
        page_size = int(request.query_params.get(paginator.page_size_query_param, paginator.page_size))
        if page_size < 1:
            page_size = paginator.page_size
        elif page_size > paginator.max_page_size:
            page_size = paginator.max_page_size
    except ValueError:
        page_size = paginator.page_size

    start = (page - 1) * page_size
    end = start + page_size

    # 3. DB-Level Counts (no model instantiations)
    students_count = students_query.distinct().count()
    teachers_count = teachers_query.distinct().count()
    courses_count = courses_query.distinct().count()
    classes_count = classes_query.distinct().count()
    sessions_count = sessions_query.distinct().count()
    assessments_count = assessments_query.distinct().count()
    invoices_count = invoices_query.distinct().count()

    total_count = max(
        students_count,
        teachers_count,
        courses_count,
        classes_count,
        sessions_count,
        assessments_count,
        invoices_count
    )

    # 4. DB-Level Sliced Queries and Formatting
    paginated_results = {
        "students": [],
        "teachers": [],
        "courses": [],
        "classes": [],
        "sessions": [],
        "assessments": [],
        "invoices": []
    }

    # Slice students
    for m in students_query.distinct()[start:end]:
        paginated_results["students"].append({
            "id": m.user.id,
            "username": m.user.username,
            "full_name": m.user.full_name or m.user.username,
            "role": "student"
        })

    # Slice teachers
    for m in teachers_query.distinct()[start:end]:
        role_name = m.role.name.lower() if m.role else 'student'
        paginated_results["teachers"].append({
            "id": m.user.id,
            "username": m.user.username,
            "full_name": m.user.full_name or m.user.username,
            "role": role_name
        })

    # Slice courses
    for c in courses_query.distinct()[start:end]:
        paginated_results["courses"].append({
            "id": c.id,
            "name": c.title,
            "code": c.code
        })

    # Slice classes
    for cl in classes_query.distinct()[start:end]:
        paginated_results["classes"].append({
            "id": cl.id,
            "name": cl.name,
            "course_name": cl.course.title
        })

    # Slice sessions
    for s in sessions_query.distinct()[start:end]:
        paginated_results["sessions"].append({
            "id": s.id,
            "title": s.title,
            "status": s.status,
            "room_code": s.active_room.room_code if s.active_room else None
        })

    # Slice assessments
    for a in assessments_query.distinct()[start:end]:
        paginated_results["assessments"].append({
            "id": a.id,
            "title": a.title,
            "is_published": a.is_published
        })

    # Slice invoices
    for inv in invoices_query.distinct()[start:end]:
        paginated_results["invoices"].append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "amount": str(inv.amount),
            "student_name": inv.student.full_name or inv.student.username,
            "status": inv.status
        })

    # 5. Build Links and Pagination Metadata
    next_link = None
    if end < total_count:
        next_link = request.build_absolute_uri()
        from urllib.parse import urlencode, urlparse, urlunparse, parse_qs
        u = list(urlparse(next_link))
        q_params = parse_qs(u[4])
        q_params[paginator.page_query_param] = [str(page + 1)]
        q_params[paginator.page_size_query_param] = [str(page_size)]
        u[4] = urlencode(q_params, doseq=True)
        next_link = urlunparse(u)

    prev_link = None
    if page > 1:
        prev_link = request.build_absolute_uri()
        from urllib.parse import urlencode, urlparse, urlunparse, parse_qs
        u = list(urlparse(prev_link))
        q_params = parse_qs(u[4])
        if page - 1 == 1:
            q_params.pop(paginator.page_query_param, None)
        else:
            q_params[paginator.page_query_param] = [str(page - 1)]
        q_params[paginator.page_size_query_param] = [str(page_size)]
        u[4] = urlencode(q_params, doseq=True)
        prev_link = urlunparse(u)

    response_data = OrderedDict([
        ('count', total_count),
        ('next', next_link),
        ('previous', prev_link),
        ('results', paginated_results)
    ])
    return Response(response_data)



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def org_context(request):
    from accounts.permissions import resolve_organization, has_org_permission, get_organization_from_request
    from accounts.models import OrgMember, Permission
    from django.utils import timezone
    from rest_framework.exceptions import PermissionDenied, ValidationError
    from .serializers import OrgContextSerializer

    org = resolve_organization(request)
    if not org:
        slug_or_id, _ = get_organization_from_request(request)
        if slug_or_id:
            raise PermissionDenied("You are not an active member of this organization.")
        raise ValidationError({'error': 'Organization context required. Include X-Organization-Slug header or org_slug query parameter.'})


    role_name = None
    permissions = []

    if request.user.is_superuser:
        permissions = list(Permission.objects.values_list('codename', flat=True))
        try:
            member = OrgMember.objects.select_related('role').get(organization=org, user=request.user)
            role_name = member.role.name if member.role else 'Superuser'
        except OrgMember.DoesNotExist:
            role_name = 'Superuser'
    else:
        try:
            member = OrgMember.objects.select_related('role').get(
                organization=org,
                user=request.user,
                is_active=True
            )
            if member.expires_at and member.expires_at < timezone.now():
                raise PermissionDenied("Your membership in this organization has expired.")
            
            role_name = member.role.name if member.role else None
            
            # Force cache population and extract
            has_org_permission(request.user, org, 'dummy')
            permissions = list(request.user._org_permissions_cache[org.id])
        except OrgMember.DoesNotExist:
            raise PermissionDenied("You are not an active member of this organization.")

    serializer = OrgContextSerializer({
        'organization': org,
        'role': role_name,
        'permissions': permissions
    })
    return Response(serializer.data)


# ---------------------------------------------------------------------------
# CRM & Financial ViewSets
# ---------------------------------------------------------------------------
from rest_framework import viewsets
from rest_framework.decorators import action
from .permissions import HasOrgPermission, has_org_permission
from .models import Course, AcademyClass, Enrollment, TuitionInvoice, ExpenseItem, Session, Attendance, Organization, OrgMember, Role, Certificate
from .serializers import (
    CourseSerializer, AcademyClassSerializer, EnrollmentSerializer,
    TuitionInvoiceSerializer, ExpenseItemSerializer, SessionSerializer, AttendanceSerializer,
    OrganizationDetailSerializer, OrgMemberSerializer, RoleSerializer, CertificateSerializer
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
        
        # Security isolation: if user is not an admin, they should only see classes they teach or are enrolled in
        if not self.request.user.is_superuser and not has_org_permission(self.request.user, org, 'can_manage_members'):
            if has_org_permission(self.request.user, org, 'can_teach_class'):
                queryset = queryset.filter(teacher=self.request.user)
            else:
                # Student view: they only see classes they are enrolled in
                queryset = queryset.filter(enrollments__student=self.request.user)
                
        include_archived = self.request.query_params.get('include_archived', '').lower() == 'true'
        if not include_archived:
            queryset = queryset.filter(is_active=True)
        return queryset.distinct()


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

    def perform_create(self, serializer):
        invoice = serializer.save()
        try:
            from accounts.notifications import record_and_dispatch
            record_and_dispatch(
                user_id=invoice.student.id,
                kind="INVOICE_CREATED",
                data={
                    "invoice_id": invoice.id,
                    "invoice_number": invoice.invoice_number,
                    "amount": str(invoice.amount),
                    "status": invoice.status,
                    "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
                }
            )
        except Exception:
            pass

    def perform_update(self, serializer):
        old_status = self.get_object().status
        invoice = serializer.save()
        try:
            if old_status != invoice.status:
                from accounts.notifications import record_and_dispatch
                record_and_dispatch(
                    user_id=invoice.student.id,
                    kind="INVOICE_UPDATED",
                    data={
                        "invoice_id": invoice.id,
                        "invoice_number": invoice.invoice_number,
                        "amount": str(invoice.amount),
                        "status": invoice.status,
                        "old_status": old_status,
                    }
                )
        except Exception:
            pass


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

    @action(detail=True, methods=['POST'])
    def approve(self, request, pk=None):
        expense = self.get_object()
        expense.approved_by = request.user
        expense.save()
        return Response(ExpenseItemSerializer(expense).data)


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


class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationDetailSerializer
    permission_classes = [HasOrgPermission]

    def get_permissions(self):
        if self.action in ['partial_update', 'update']:
            self.required_org_permission = 'can_manage_members'
        else:
            self.required_org_permission = 'can_view_dashboard'
        return super().get_permissions()

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if not org:
            return Organization.objects.none()
        return Organization.objects.filter(id=org.id)

    def destroy(self, request, *args, **kwargs):
        from rest_framework.exceptions import MethodNotAllowed
        raise MethodNotAllowed("DELETE")


class OrgMemberViewSet(viewsets.ModelViewSet):
    serializer_class = OrgMemberSerializer
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
            return OrgMember.objects.none()
        return OrgMember.objects.filter(organization=org).select_related('user', 'role').prefetch_related(
            'user__org_memberships__organization',
            'user__org_memberships__role'
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        from django.core.cache import cache
        cache_key = f"user_org_perms:{instance.user_id}:{instance.organization_id}"
        cache.delete(cache_key)

    def perform_destroy(self, instance):
        user_id = instance.user_id
        org_id = instance.organization_id
        instance.delete()
        from django.core.cache import cache
        cache_key = f"user_org_perms:{user_id}:{org_id}"
        cache.delete(cache_key)


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RoleSerializer
    permission_classes = [HasOrgPermission]
    required_org_permission = 'can_view_dashboard'

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if not org:
            return Role.objects.none()
        return Role.objects.filter(
            models.Q(organization=org) | models.Q(organization__isnull=True)
        )


class CertificateViewSet(viewsets.ModelViewSet):
    serializer_class = CertificateSerializer
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
            return Certificate.objects.none()
        queryset = Certificate.objects.filter(organization=org).select_related(
            'student', 'academy_class__course'
        )
        # Students can view only their own certificates; teachers/admins can view all for that org
        if not has_org_permission(self.request.user, org, 'can_manage_members') and \
           not has_org_permission(self.request.user, org, 'can_teach_class') and \
           not self.request.user.is_superuser:
            queryset = queryset.filter(student=self.request.user)
        return queryset


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def audit_logs(request):
    from accounts.permissions import has_org_permission, resolve_organization
    from accounts.models import AuditLog
    from accounts.serializers import AuditLogSerializer
    from rest_framework.pagination import PageNumberPagination

    org = resolve_organization(request)
    if not org:
        return Response({'error': 'Organization context is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Authorization: Only users with can_manage_members or superusers can view audit logs
    if not request.user.is_superuser and not has_org_permission(request.user, org, 'can_manage_members'):
        return Response({'error': 'Permission denied: can_manage_members required.'}, status=status.HTTP_403_FORBIDDEN)

    if request.query_params.get('get_filters') == 'true':
        actions = list(AuditLog.objects.filter(organization=org).values_list('action', flat=True).distinct())
        entities = list(AuditLog.objects.filter(organization=org).values_list('entity_type', flat=True).distinct())
        actors_data = list(AuditLog.objects.filter(organization=org, actor__isnull=False)
                           .values('actor_id', 'actor__username', 'actor__full_name').distinct())
        return Response({
            'actions': actions,
            'entities': entities,
            'actors': actors_data
        })

    queryset = AuditLog.objects.filter(organization=org).select_related('actor').order_by('-created_at')

    # Optional Filters
    actor_id = request.query_params.get('actor_id')
    action = request.query_params.get('action')
    entity_type = request.query_params.get('entity_type')

    if actor_id:
        queryset = queryset.filter(actor_id=actor_id)
    if action:
        queryset = queryset.filter(action=action)
    if entity_type:
        queryset = queryset.filter(entity_type=entity_type)

    # Pagination
    paginator = PageNumberPagination()
    paginator.page_size = 15
    paginator.page_size_query_param = 'page_size'
    paginator.max_page_size = 100
    
    result_page = paginator.paginate_queryset(queryset, request)
    serializer = AuditLogSerializer(result_page, many=True)
    return paginator.get_paginated_response(serializer.data)


