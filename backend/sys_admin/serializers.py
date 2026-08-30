from rest_framework import serializers
from accounts.models import Organization, User
from sys_admin.models import SystemConfig, OrganizationQuota, OrganizationUsage, OperatorAuditLog

class SystemConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfig
        fields = ('id', 'key', 'value', 'description', 'created_at', 'updated_at')
        read_only_fields = ('id', 'key', 'created_at', 'updated_at')


class OrganizationQuotaSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationQuota
        fields = ('id', 'max_students', 'max_teachers', 'max_courses', 'max_storage_gb', 'max_active_sessions', 'max_recording_minutes')
        read_only_fields = ('id',)


class OrganizationUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationUsage
        fields = ('id', 'students_count', 'teachers_count', 'courses_count', 'storage_used_gb', 'active_sessions_count', 'recording_minutes_used')
        read_only_fields = ('id', 'students_count', 'teachers_count', 'courses_count', 'storage_used_gb', 'active_sessions_count', 'recording_minutes_used')


class OrganizationAdminSerializer(serializers.ModelSerializer):
    quota = OrganizationQuotaSerializer(required=False)
    usage = OrganizationUsageSerializer(read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True)

    class Meta:
        model = Organization
        fields = (
            'id', 'name', 'slug', 'type', 'owner', 'owner_username',
            'is_active', 'is_suspended', 'suspended_at', 'suspension_reason',
            'logo', 'created_at', 'quota', 'usage'
        )
        read_only_fields = ('id', 'slug', 'owner_username', 'usage', 'created_at')

    def update(self, instance, validated_data):
        quota_data = validated_data.pop('quota', None)
        
        # Update Organization
        instance = super().update(instance, validated_data)
        
        # Update or Create Quota
        if quota_data:
            OrganizationQuota.objects.update_or_create(
                organization=instance,
                defaults=quota_data
            )
            
        return instance


class OperatorAuditLogSerializer(serializers.ModelSerializer):
    operator_username = serializers.CharField(source='operator.username', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = OperatorAuditLog
        fields = ('id', 'operator', 'operator_username', 'action', 'organization', 'organization_name', 'metadata', 'created_at')
        read_only_fields = ('id', 'operator', 'operator_username', 'created_at')
