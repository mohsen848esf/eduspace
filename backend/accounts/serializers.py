from rest_framework import serializers
from .models import User, Course, AcademyClass, Enrollment, TuitionInvoice, ExpenseItem, Session, Attendance, Organization, OrgMember, Role, Certificate, AuditLog, Permission, UserSession, InvoiceLineItem


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('username', 'email', 'full_name', 'password')

    def create(self, validated_data):
        
        kwargs = {
            'username': validated_data['username'],
            'email': validated_data['email'],
            'full_name': validated_data.get('full_name', ''),
            'password': validated_data['password'],
        }
        
        user = User.objects.create_user(**kwargs)
        return user


class UserSerializer(serializers.ModelSerializer):
    organizations = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'full_name', 'avatar', 'is_online', 'is_superuser', 'organizations')
        read_only_fields = ('id',)

    def validate_avatar(self, value):
        if value:
            name = value.name.lower()
            content_type = getattr(value, 'content_type', '')
            if name.endswith('.svg') or content_type == 'image/svg+xml':
                raise serializers.ValidationError("Only academy logo can be an SVG file")
        return value

    def get_organizations(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'org_memberships' in obj._prefetched_objects_cache:
            memberships = [
                m for m in obj.org_memberships.all()
                if m.is_active
            ]
        else:
            memberships = obj.org_memberships.filter(is_active=True).select_related('organization', 'role')
        return [
            {
                'id': m.organization.id,
                'name': m.organization.name,
                'slug': m.organization.slug,
                'role': m.role.name if m.role else None
            }
            for m in memberships
        ]


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ('id', 'title', 'code', 'description', 'price', 'is_active', 'thumbnail', 'created_by', 'created_at')
        read_only_fields = ('id', 'created_by', 'created_at')

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class CompactSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ('id', 'status', 'scheduled_start')


class AcademyClassSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    mentor_name = serializers.CharField(source='mentor.full_name', read_only=True)
    session_count = serializers.IntegerField(read_only=True)
    latest_session = CompactSessionSerializer(read_only=True)

    class Meta:
        model = AcademyClass
        fields = (
            'id', 'course', 'course_title', 'course_code', 'teacher', 'teacher_name',
            'mentor', 'mentor_name',
            'name', 'start_date', 'end_date', 'room', 'is_active', 'max_students',
            'session_count', 'latest_session', 'created_by', 'created_at'
        )
        read_only_fields = ('id', 'created_by', 'created_at')

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)

    def validate_course(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            if value.organization != request.organization:
                raise serializers.ValidationError("Course does not belong to your organization.")
        return value


class EnrollmentSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_full_name = serializers.CharField(source='student.full_name', read_only=True)
    class_name = serializers.CharField(source='academy_class.name', read_only=True)

    class Meta:
        model = Enrollment
        fields = ('id', 'academy_class', 'class_name', 'student', 'student_username', 'student_full_name', 'enrolled_at', 'is_active', 'enrolled_by', 'completion_status', 'completion_date')
        read_only_fields = ('id', 'enrolled_at', 'enrolled_by')
        validators = []  # Remove default validators so we can handle upsert in create

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['enrolled_by'] = request.user
            
        academy_class = validated_data.get('academy_class')
        student = validated_data.get('student')
        
        # Upsert logic: if enrollment already exists, update it instead of failing
        enrollment = Enrollment.objects.filter(academy_class=academy_class, student=student).first()
        if enrollment:
            for attr, value in validated_data.items():
                setattr(enrollment, attr, value)
            enrollment.save()
            return enrollment
            
        return super().create(validated_data)

    def validate_academy_class(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            if value.course.organization != request.organization:
                raise serializers.ValidationError("Class does not belong to your organization.")
        return value

    def validate_student(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            org = request.organization
            from accounts.models import OrgMember
            if not OrgMember.objects.filter(organization=org, user=value, is_active=True).exists():
                raise serializers.ValidationError("Student is not an active member of this organization.")
        return value


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = ('description', 'quantity', 'unit_price')

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value


class TuitionInvoiceSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_full_name = serializers.CharField(source='student.full_name', read_only=True)
    class_name = serializers.CharField(source='academy_class.name', read_only=True)
    items = InvoiceLineItemSerializer(many=True, source='line_items', required=False)

    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)

    class Meta:
        model = TuitionInvoice
        fields = (
            'id', 'student', 'student_username', 'student_full_name', 'academy_class', 'class_name',
            'amount', 'status', 'due_date', 'paid_at', 'invoice_number', 'payment_method', 'issued_by',
            'notes', 'items', 'created_at'
        )
        read_only_fields = ('id', 'invoice_number', 'issued_by', 'created_at')

    def validate(self, attrs):
        # Line items are represented under the source name 'line_items'
        line_items_data = attrs.get('line_items', None)
        
        if line_items_data is not None:
            try:
                total_amount = sum(
                    float(item.get("unit_price", 0)) * int(item.get("quantity", 1))
                    for item in line_items_data
                )
                attrs["amount"] = total_amount
            except (ValueError, TypeError):
                raise serializers.ValidationError({"items": "Invalid line item price or quantity."})

        if not self.instance and 'amount' not in attrs:
            raise serializers.ValidationError({"amount": "This field is required."})

        request = self.context.get('request')
        org = getattr(request, 'organization', None) if request else None

        if org:
            student = attrs.get('student', self.instance.student if self.instance else None)
            if student:
                from accounts.models import OrgMember
                if not OrgMember.objects.filter(organization=org, user=student, is_active=True).exists():
                    raise serializers.ValidationError({"student": "Student is not an active member of this organization."})

            academy_class = attrs.get('academy_class', self.instance.academy_class if self.instance else None)
            if academy_class:
                if academy_class.course.organization != org:
                    raise serializers.ValidationError({"academy_class": "Class does not belong to this organization."})

        return attrs

    def create(self, validated_data):
        from django.db import transaction
        line_items_data = validated_data.pop('line_items', [])
        
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            org = request.organization
            validated_data['organization'] = org
            if not validated_data.get('invoice_number'):
                with transaction.atomic():
                    from accounts.models import Organization
                    # Acquire lock on organization row to serialize sequential counting
                    Organization.objects.select_for_update().get(id=org.id)
                    count = TuitionInvoice.objects.filter(organization=org).count()
                    validated_data['invoice_number'] = f"INV-{org.id}-{count + 1:04d}"
        if request and request.user and request.user.is_authenticated:
            validated_data['issued_by'] = request.user
            
        with transaction.atomic():
            invoice = TuitionInvoice.objects.create(**validated_data)
            for item_data in line_items_data:
                InvoiceLineItem.objects.create(invoice=invoice, **item_data)
                
        return invoice

    def update(self, instance, validated_data):
        from django.db import transaction
        line_items_data = validated_data.pop('line_items', None)
        
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            
            if line_items_data is not None:
                # Normalization replacement strategy: delete old line items and insert new ones
                instance.line_items.all().delete()
                for item_data in line_items_data:
                    InvoiceLineItem.objects.create(invoice=instance, **item_data)
                    
        return instance

    def validate_academy_class(self, value):
        if value:
            request = self.context.get('request')
            if request and hasattr(request, 'organization'):
                if value.course.organization != request.organization:
                    raise serializers.ValidationError("Class does not belong to your organization.")
            return value


class ExpenseItemSerializer(serializers.ModelSerializer):
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)
    recipient_full_name = serializers.CharField(source='recipient.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)

    class Meta:
        model = ExpenseItem
        fields = ('id', 'amount', 'category', 'description', 'recipient', 'recipient_username', 'recipient_full_name', 'approved_by', 'approved_by_name', 'attachment', 'incurred_at', 'created_at')
        read_only_fields = ('id', 'approved_by', 'created_at')

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
        if request and request.user and request.user.is_authenticated:
            validated_data['approved_by'] = request.user
        return super().create(validated_data)


class SessionSerializer(serializers.ModelSerializer):
    academy_class_name = serializers.CharField(source='academy_class.name', read_only=True)
    host_name = serializers.CharField(source='host.full_name', read_only=True)
    active_room_code = serializers.CharField(source='active_room.room_code', read_only=True)

    class Meta:
        model = Session
        fields = (
            'id', 'academy_class', 'academy_class_name', 'organization', 'host', 'host_name',
            'created_by', 'active_room', 'active_room_code', 'title', 'scheduled_start', 'scheduled_end',
            'status', 'created_at'
        )
        read_only_fields = ('id', 'organization', 'created_by', 'active_room', 'status', 'created_at')
        extra_kwargs = {
            'host': {'required': False, 'allow_null': True}
        }

    def validate_academy_class(self, value):
        if value:
            request = self.context.get('request')
            if request and hasattr(request, 'organization'):
                if value.course.organization != request.organization:
                    raise serializers.ValidationError("Class does not belong to your organization.")
                    
                # Security: check if user is allowed to manage sessions for this class
                from accounts.permissions import has_org_permission
                if not request.user.is_superuser and \
                   not has_org_permission(request.user, request.organization, 'can_manage_sessions') and \
                   not has_org_permission(request.user, request.organization, 'can_manage_members'):
                    if has_org_permission(request.user, request.organization, 'can_teach_class'):
                        if value.teacher != request.user:
                            raise serializers.ValidationError("You can only create sessions for classes you teach.")
                    else:
                        raise serializers.ValidationError("You do not have permission to create sessions.")
        return value

    def validate_host(self, value):
        if value:
            request = self.context.get('request')
            if request and hasattr(request, 'organization'):
                from accounts.models import OrgMember
                if not OrgMember.objects.filter(organization=request.organization, user=value, is_active=True).exists():
                    raise serializers.ValidationError("Host must be an active member of your organization.")
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        
        # Set default host if not provided
        if not validated_data.get('host'):
            academy_class = validated_data.get('academy_class')
            if academy_class and academy_class.teacher:
                validated_data['host'] = academy_class.teacher
            elif request and request.user:
                validated_data['host'] = request.user

        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class AttendanceSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_full_name = serializers.CharField(source='student.full_name', read_only=True)
    session_title = serializers.CharField(source='session.title', read_only=True)
    academy_class_name = serializers.CharField(source='session.academy_class.name', read_only=True)
    academy_class = serializers.IntegerField(source='session.academy_class.id', read_only=True)

    class Meta:
        model = Attendance
        fields = ('id', 'session', 'session_title', 'academy_class', 'academy_class_name', 'student', 'student_username', 'student_full_name', 'status', 'joined_at', 'left_at', 'note')
        read_only_fields = ('id', 'session', 'student', 'joined_at', 'left_at')


class OrgContextSerializer(serializers.Serializer):
    organization = serializers.SerializerMethodField()
    role = serializers.CharField(allow_null=True)
    permissions = serializers.ListField(child=serializers.CharField())

    def get_organization(self, obj):
        org = obj.get('organization')
        if org:
            request = self.context.get('request')
            logo_url = None
            if org.logo:
                if request:
                    logo_url = request.build_absolute_uri(org.logo.url)
                else:
                    logo_url = org.logo.url
            return {
                'id': org.id,
                'name': org.name,
                'slug': org.slug,
                'logo': logo_url,
                'invite_code': org.invite_code,
                'is_suspended': org.is_suspended,
                'suspension_reason': org.suspension_reason,
            }
        return None


class OrganizationDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ('id', 'name', 'slug', 'type', 'is_active', 'logo', 'created_at', 'approval_required_to_join', 'invite_code')
        read_only_fields = ('id', 'slug', 'type', 'is_active', 'created_at', 'invite_code')


class OrgMemberSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)
    username = serializers.CharField(write_only=True, required=False)
    email = serializers.CharField(write_only=True, required=False)
    user_details = UserSerializer(source='user', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)

    class Meta:
        model = OrgMember
        fields = (
            'id', 'user', 'user_details', 'role', 'role_name', 'username', 'email',
            'is_active', 'contract_type', 'joined_at', 'expires_at'
        )
        read_only_fields = ('id', 'joined_at')

    def validate_role(self, value):
        if value:
            request = self.context.get('request')
            org = getattr(request, 'organization', None)
            if org and value.organization and value.organization != org:
                raise serializers.ValidationError("Role does not belong to your organization.")
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        org = getattr(request, 'organization', None)
        if not org:
            raise serializers.ValidationError("Organization context required.")

        user = validated_data.get('user', None)
        username = validated_data.pop('username', None)
        email = validated_data.pop('email', None)

        if not user:
            if username:
                if str(username).isdigit():
                    user = User.objects.filter(id=int(username)).first()
                if not user:
                    user = User.objects.filter(username=username).first()
            elif email:
                user = User.objects.filter(email=email).first()

            if not user:
                raise serializers.ValidationError("User not found on the system. Please verify the user ID, username or email.")

        if OrgMember.objects.filter(organization=org, user=user).exists():
            raise serializers.ValidationError("This user is already a member of this organization.")

        validated_data['organization'] = org
        validated_data['user'] = user
        validated_data['invited_by'] = request.user if request and request.user.is_authenticated else None
        return super().create(validated_data)


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SlugRelatedField(
        many=True,
        slug_field='codename',
        queryset=Permission.objects.all(),
        required=False
    )

    class Meta:
        model = Role
        fields = ('id', 'name', 'description', 'permissions')

    def validate_name(self, value):
        default_role_names = ["admin", "teacher", "student", "mentor"]
        if value.strip().lower() in default_role_names:
            raise serializers.ValidationError("Cannot create or modify a role with a system default name (Admin, Teacher, Student, Mentor).")
        return value


class CertificateSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_full_name = serializers.CharField(source='student.full_name', read_only=True)
    class_name = serializers.CharField(source='academy_class.name', read_only=True)
    course_title = serializers.CharField(source='academy_class.course.title', read_only=True)

    class Meta:
        model = Certificate
        fields = (
            'id', 'organization', 'student', 'student_username', 'student_full_name',
            'academy_class', 'class_name', 'course_title', 'certificate_number', 'issued_at'
        )
        read_only_fields = ('id', 'organization', 'student', 'certificate_number', 'issued_at')


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.full_name', read_only=True, default='')
    actor_username = serializers.CharField(source='actor.username', read_only=True, default='')

    class Meta:
        model = AuditLog
        fields = (
            'id', 'actor', 'actor_name', 'actor_username', 'action',
            'entity_type', 'entity_id', 'before_state', 'after_state',
            'ip_address', 'user_agent', 'created_at'
        )
        read_only_fields = fields


from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken

class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = RefreshToken(attrs['refresh'])
        session_id = refresh.payload.get('session_id')
        if session_id:
            from .models import UserSession
            try:
                session = UserSession.objects.get(id=session_id)
                if not session.is_active:
                    from rest_framework_simplejwt.exceptions import InvalidToken
                    raise InvalidToken("Session has been revoked or is inactive.")

                # Check organization suspension
                user = session.user
                if not user.is_superuser:
                    memberships = user.org_memberships.filter(is_active=True)
                    if memberships.exists() and not memberships.filter(organization__is_suspended=False).exists():
                        from rest_framework_simplejwt.exceptions import InvalidToken
                        raise InvalidToken("Your organization is suspended.")
            except UserSession.DoesNotExist:
                from rest_framework_simplejwt.exceptions import InvalidToken
                raise InvalidToken("Session not found.")
            
            # Inject session_id into new access token
            access_token = AccessToken(data['access'])
            access_token['session_id'] = session_id
            data['access'] = str(access_token)
        return data


class UserSessionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = UserSession
        fields = ('id', 'username', 'full_name', 'ip_address', 'user_agent', 'is_active', 'is_current', 'created_at', 'updated_at')
        read_only_fields = fields

    def get_is_current(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'auth') and request.auth:
            return request.auth.get('session_id') == obj.id
        return False


