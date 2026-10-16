from rest_framework import serializers
from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "category",
            "severity",
            "title",
            "message",
            "reference_type",
            "reference_id",
            "action_url",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "category",
            "severity",
            "title",
            "message",
            "reference_type",
            "reference_id",
            "action_url",
            "created_at",
        ]
