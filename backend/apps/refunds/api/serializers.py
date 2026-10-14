from rest_framework import serializers
from apps.refunds.models import Refund, RefundPaymentAllocation

class RefundPaymentAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefundPaymentAllocation
        fields = [
            "id",
            "payment",
            "amount",
            "allocated_at",
        ]

class RefundSerializer(serializers.ModelSerializer):
    allocations = RefundPaymentAllocationSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.username", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.username", read_only=True)
    completed_by_name = serializers.CharField(source="completed_by.username", read_only=True)
    rejected_by_name = serializers.CharField(source="rejected_by.username", read_only=True)

    class Meta:
        model = Refund
        fields = [
            "id",
            "refund_number",
            "customer",
            "customer_name",
            "source_type",
            "source_id",
            "amount",
            "method",
            "status",
            "reference",
            "reason",
            "notes",
            "requested_at",
            "requested_by",
            "requested_by_name",
            "approved_at",
            "approved_by",
            "approved_by_name",
            "completed_at",
            "completed_by",
            "completed_by_name",
            "rejected_at",
            "rejected_by",
            "rejected_by_name",
            "allocations",
        ]


class CreateRefundSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField(required=True)
    source_type = serializers.ChoiceField(choices=Refund.SourceType.choices, required=True)
    source_id = serializers.IntegerField(required=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    method = serializers.ChoiceField(choices=Refund.Method.choices, required=True)
    reason = serializers.CharField(required=False, allow_blank=True, default="")
    reference = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class RejectRefundSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")
