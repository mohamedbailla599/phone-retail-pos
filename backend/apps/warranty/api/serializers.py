from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from apps.warranty.models import RepairTicket


def generate_repair_ticket_number() -> str:
    year = timezone.now().year
    prefix = f"BP-REP-{year}-"
    last = RepairTicket.objects.filter(ticket_number__startswith=prefix).order_by("-ticket_number").first()
    if last:
        try:
            seq = int(last.ticket_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:06d}"


class RepairTicketSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    assigned_technician_name = serializers.SerializerMethodField()
    remaining_balance = serializers.SerializerMethodField()
    issue_type_display = serializers.CharField(source="get_issue_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = RepairTicket
        fields = [
            "id",
            "ticket_number",
            "customer",
            "customer_name",
            "customer_phone",
            "device_brand",
            "device_model",
            "device_color",
            "imei_or_serial",
            "passcode",
            "issue_type",
            "issue_type_display",
            "issue_description",
            "technician_notes",
            "status",
            "status_display",
            "estimated_cost",
            "final_cost",
            "deposit_paid",
            "remaining_balance",
            "is_paid",
            "payment_method",
            "warranty_days",
            "created_by",
            "created_by_name",
            "created_by_username",
            "assigned_technician",
            "assigned_technician_name",
            "estimated_completion_date",
            "completed_at",
            "delivered_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "ticket_number",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return "Staff"
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_assigned_technician_name(self, obj):
        if not obj.assigned_technician:
            return None
        return obj.assigned_technician.get_full_name() or obj.assigned_technician.username

    def get_remaining_balance(self, obj):
        cost = obj.final_cost if obj.final_cost > Decimal("0.00") else obj.estimated_cost
        balance = cost - obj.deposit_paid
        return f"{max(balance, Decimal('0.00')):.2f}"


class CreateRepairTicketSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    customer_name = serializers.CharField(max_length=100)
    customer_phone = serializers.CharField(max_length=50)

    device_brand = serializers.CharField(max_length=50)
    device_model = serializers.CharField(max_length=100)
    device_color = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    imei_or_serial = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    passcode = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)

    issue_type = serializers.ChoiceField(
        choices=RepairTicket.IssueType.choices,
        default=RepairTicket.IssueType.SCREEN,
    )
    issue_description = serializers.CharField()
    estimated_cost = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    deposit_paid = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, default=0)
    estimated_completion_date = serializers.DateField(required=False, allow_null=True)


class UpdateRepairStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=RepairTicket.Status.choices)
    technician_notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    final_cost = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False, allow_null=True)
    assigned_technician_id = serializers.IntegerField(required=False, allow_null=True)


class DeliverRepairSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=["CASH", "BANK_TRANSFER"])
    reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
