from rest_framework import serializers
from apps.returns.models import Return, ReturnItem

class ReturnItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnItem
        fields = [
            "id",
            "transaction_item",
            "quantity",
            "unit_refund_amount",
            "line_total",
        ]

class ReturnSerializer(serializers.ModelSerializer):
    items = ReturnItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.username", read_only=True)

    class Meta:
        model = Return
        fields = [
            "id",
            "return_number",
            "transaction",
            "customer",
            "customer_name",
            "status",
            "reason",
            "total_amount",
            "created_at",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_by_name",
            "items",
        ]


class CreateReturnSerializer(serializers.Serializer):
    transaction_id = serializers.IntegerField(required=True)
    transaction_item_id = serializers.IntegerField(required=True)
    quantity = serializers.IntegerField(required=True, min_value=1)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class ProcessDeviceReturnSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")
