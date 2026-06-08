from rest_framework import serializers
from .models import User, Course, AcademyClass, Enrollment, TuitionInvoice, ExpenseItem


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('username', 'email', 'full_name', 'password', 'role')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            full_name=validated_data.get('full_name', ''),
            password=validated_data['password'],
            role=validated_data.get('role', User.Role.STUDENT),
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'full_name', 'role', 'avatar', 'is_online')
        read_only_fields = ('id',)


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


class AcademyClassSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)

    class Meta:
        model = AcademyClass
        fields = ('id', 'course', 'course_title', 'course_code', 'teacher', 'teacher_name', 'name', 'start_date', 'end_date', 'room', 'is_active', 'max_students', 'created_by', 'created_at')
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

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['enrolled_by'] = request.user
        return super().create(validated_data)

    def validate_academy_class(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            if value.course.organization != request.organization:
                raise serializers.ValidationError("Class does not belong to your organization.")
        return value


class TuitionInvoiceSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_full_name = serializers.CharField(source='student.full_name', read_only=True)
    class_name = serializers.CharField(source='academy_class.name', read_only=True)

    class Meta:
        model = TuitionInvoice
        fields = ('id', 'student', 'student_username', 'student_full_name', 'academy_class', 'class_name', 'amount', 'status', 'due_date', 'paid_at', 'invoice_number', 'payment_method', 'issued_by', 'notes', 'created_at')
        read_only_fields = ('id', 'invoice_number', 'issued_by', 'created_at')

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            org = request.organization
            validated_data['organization'] = org
            if not validated_data.get('invoice_number'):
                count = TuitionInvoice.objects.filter(organization=org).count()
                validated_data['invoice_number'] = f"INV-{org.id}-{count + 1:04d}"
        if request and request.user and request.user.is_authenticated:
            validated_data['issued_by'] = request.user
        return super().create(validated_data)

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

    class Meta:
        model = ExpenseItem
        fields = ('id', 'amount', 'category', 'description', 'recipient', 'recipient_username', 'recipient_full_name', 'approved_by', 'attachment', 'incurred_at', 'created_at')
        read_only_fields = ('id', 'approved_by', 'created_at')

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
        if request and request.user and request.user.is_authenticated:
            validated_data['approved_by'] = request.user
        return super().create(validated_data)