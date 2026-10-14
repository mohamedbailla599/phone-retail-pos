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
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    source_label = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()
    rejected_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Refund
        fields = [
            "id",
            "refund_number",
            "customer",
            "customer_name",
            "customer_phone",
            "source_type",
            "source_id",
            "source_label",
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

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.full_name
        return "Client Comptoir"

    def get_customer_phone(self, obj):
        if obj.customer:
            return obj.customer.phone_number
        return ""

    def get_source_label(self, obj):
        if obj.source_type == Refund.SourceType.RETURN:
            try:
                ret = Return.objects.select_related("transaction").filter(id=obj.source_id).first()
                if ret:
                    return f"{ret.return_number} (Ticket {ret.transaction.receipt_id})"
            except Exception:
                pass
        return f"{obj.source_type} #{obj.source_id}"

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return ""

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return ""

    def get_completed_by_name(self, obj):
        if obj.completed_by:
            return obj.completed_by.get_full_name() or obj.completed_by.username
        return ""

    def get_rejected_by_name(self, obj):
        if obj.rejected_by:
            return obj.rejected_by.get_full_name() or obj.rejected_by.username
        return ""


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
