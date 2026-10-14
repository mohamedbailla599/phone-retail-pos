from decimal import Decimal
from django.db.models import Sum
from rest_framework import serializers

from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.payments.models import Payment
from apps.reservations.models import Reservation


class ReservationPaymentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "amount",
            "method",
            "status",
            "reference",
            "created_at",
            "confirmed_at",
            "created_by_name",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ""


class ReservationSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone_number", read_only=True)
    customer_current_debt = serializers.DecimalField(
        source="customer.current_debt", max_digits=12, decimal_places=2, read_only=True
    )
    
    device_imei = serializers.SerializerMethodField()
    device_name = serializers.SerializerMethodField()
    device_brand = serializers.SerializerMethodField()
    device_model = serializers.SerializerMethodField()
    device_color = serializers.CharField(source="device.color", read_only=True)
    device_battery = serializers.IntegerField(source="device.battery_health", read_only=True)
    device_storage = serializers.CharField(source="device.storage_capacity", read_only=True)
    device_status = serializers.CharField(source="device.status", read_only=True)
    
    receipt_id = serializers.CharField(source="transaction.receipt_id", read_only=True)
    paid_amount = serializers.SerializerMethodField()
    remaining_balance = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()

    cancelled_by_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = [
            "id",
            "reservation_number",
            "status",
            "customer",
            "customer_name",
            "customer_phone",
            "customer_current_debt",
            "device",
            "device_imei",
            "device_name",
            "device_brand",
            "device_model",
            "device_color",
            "device_battery",
            "device_storage",
            "device_status",
            "transaction",
            "receipt_id",
            "reserved_price",
            "paid_amount",
            "remaining_balance",
            "payments",
            "reserved_at",
            "expires_at",
            "notes",
            "cancelled_at",
            "cancelled_by",
            "cancelled_by_name",
            "completed_at",
            "completed_by",
            "completed_by_name",
            "created_at",
            "updated_at",
        ]

    def get_device_imei(self, obj):
        if obj.device:
            return obj.device.imei_1 or obj.device.serial_number or ""
        return ""

    def get_device_name(self, obj):
        if obj.device and obj.device.product:
            return obj.device.product.name
        return ""

    def get_device_brand(self, obj):
        if obj.device and obj.device.product:
            return obj.device.product.brand or ""
        return ""

    def get_device_model(self, obj):
        if obj.device and obj.device.product:
            return obj.device.product.name or ""
        return ""

    def get_paid_amount(self, obj):
        if not obj.transaction:
            return "0.00"
        total = (
            obj.transaction.payments
            .filter(status=Payment.Status.CONFIRMED)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        return str(total)

    def get_remaining_balance(self, obj):
        if not obj.transaction:
            return str(obj.reserved_price)
        paid = (
            obj.transaction.payments
            .filter(status=Payment.Status.CONFIRMED)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        remaining = max(obj.reserved_price - paid, Decimal("0.00"))
        return str(remaining)

    def get_payments(self, obj):
        if not obj.transaction:
            return []
        payments = obj.transaction.payments.all().order_by("created_at")
        return ReservationPaymentSerializer(payments, many=True).data

    def get_cancelled_by_name(self, obj):
        if obj.cancelled_by:
            return obj.cancelled_by.get_full_name() or obj.cancelled_by.username
        return ""

    def get_completed_by_name(self, obj):
        if obj.completed_by:
            return obj.completed_by.get_full_name() or obj.completed_by.username
        return ""


class CreateReservationSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    device_id = serializers.IntegerField()
    reserved_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    duration_days = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    deposit_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0.00")
    )
    deposit_method = serializers.ChoiceField(
        choices=Payment.Method.choices, default=Payment.Method.CASH
    )
    deposit_reference = serializers.CharField(
        max_length=150, required=False, allow_blank=True, allow_null=True
    )
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class CompleteReservationSerializer(serializers.Serializer):
    payment_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0.00")
    )
    payment_method = serializers.ChoiceField(
        choices=Payment.Method.choices, default=Payment.Method.CASH
    )
    payment_reference = serializers.CharField(
        max_length=150, required=False, allow_blank=True, allow_null=True
    )


class CancelReservationSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    refund_deposit = serializers.BooleanField(default=False)
    refund_method = serializers.ChoiceField(
        choices=Payment.Method.choices, default=Payment.Method.CASH
    )


class AddReservationPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )
    method = serializers.ChoiceField(choices=Payment.Method.choices, default=Payment.Method.CASH)
    reference = serializers.CharField(
        max_length=150, required=False, allow_blank=True, allow_null=True
    )
