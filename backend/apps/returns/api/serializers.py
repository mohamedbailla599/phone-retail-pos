from rest_framework import serializers
from apps.returns.models import Return, ReturnItem

class ReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="transaction_item.product_name_snapshot", read_only=True)
    sku = serializers.CharField(source="transaction_item.sku_snapshot", read_only=True)
    is_device = serializers.SerializerMethodField()
    identifier = serializers.SerializerMethodField()

    class Meta:
        model = ReturnItem
        fields = [
            "id",
            "transaction_item",
            "product_name",
            "sku",
            "is_device",
            "identifier",
            "quantity",
            "unit_refund_amount",
            "line_total",
        ]

    def get_is_device(self, obj):
        return bool(obj.transaction_item and obj.transaction_item.device_id)

    def get_identifier(self, obj):
        if obj.transaction_item and obj.transaction_item.device:
            return obj.transaction_item.device.imei_1 or obj.transaction_item.device.serial_number or ""
        return ""


class ReturnSerializer(serializers.ModelSerializer):
    items = ReturnItemSerializer(many=True, read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    receipt_id = serializers.CharField(source="transaction.receipt_id", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Return
        fields = [
            "id",
            "return_number",
            "transaction",
            "receipt_id",
            "customer",
            "customer_name",
            "customer_phone",
            "status",
            "reason",
            "total_amount",
            "created_at",
            "completed_at",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_by_name",
            "items",
        ]

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.full_name
        if obj.transaction and obj.transaction.customer_name:
            return obj.transaction.customer_name
        return "Client Comptoir"

    def get_customer_phone(self, obj):
        if obj.customer:
            return obj.customer.phone_number
        if obj.transaction and obj.transaction.customer_phone:
            return obj.transaction.customer_phone
        return ""

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ""

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return ""


class CreateReturnSerializer(serializers.Serializer):
    transaction_id = serializers.IntegerField(required=True)
    transaction_item_id = serializers.IntegerField(required=True)
    quantity = serializers.IntegerField(required=True, min_value=1)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class ProcessDeviceReturnSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")
