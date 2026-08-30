from rest_framework import serializers
from notifications.models import Notification, NotificationPreference, NotificationTemplate

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'channel', 'title', 'message', 'status', 'sent_at', 'read_at', 'created_at')
        read_only_fields = ('id', 'channel', 'title', 'message', 'status', 'sent_at', 'read_at', 'created_at')


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ('category', 'email_enabled', 'sms_enabled', 'in_app_enabled')


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = ('id', 'name', 'slug', 'channel', 'subject', 'body', 'is_active')
        read_only_fields = ('id',)

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'organization'):
            validated_data['organization'] = request.organization
        return super().create(validated_data)
