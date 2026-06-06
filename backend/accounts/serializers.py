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
        fields = ('id', 'title', 'code', 'description', 'price', 'created_at')
        read_only_fields = ('id', 'created_at')

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
        return super().create(validated_data)


class AcademyClassSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)

    class Meta:
        model = AcademyClass
        fields = ('id', 'course', 'course_title', 'course_code', 'teacher', 'teacher_name', 'name', 'start_date', 'end_date', 'room', 'created_at')
        read_only_fields = ('id', 'created_at')

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
        fields = ('id', 'academy_class', 'class_name', 'student', 'student_username', 'student_full_name', 'enrolled_at', 'is_active')
        read_only_fields = ('id', 'enrolled_at')

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
        fields = ('id', 'student', 'student_username', 'student_full_name', 'academy_class', 'class_name', 'amount', 'status', 'due_date', 'paid_at', 'created_at')
        read_only_fields = ('id', 'created_at')

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
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
        fields = ('id', 'amount', 'category', 'description', 'recipient', 'recipient_username', 'recipient_full_name', 'incurred_at', 'created_at')
        read_only_fields = ('id', 'created_at')

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
        return super().create(validated_data)