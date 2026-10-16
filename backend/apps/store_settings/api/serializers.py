from rest_framework import serializers

from apps.store_settings.models import StoreSettings


class StoreSettingsSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StoreSettings
        fields = [
            "id",
            "store_name",
            "phone_number",
            "address",
            "currency",
            "receipt_prefix",
            "receipt_footer_message",
            "owner_email",
            "daily_digest_enabled",
            "default_device_warranty_months",
            "default_accessory_warranty_months",
            "default_reservation_months",
            "updated_by",
            "updated_by_name",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_by", "updated_by_name", "updated_at"]

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return None
