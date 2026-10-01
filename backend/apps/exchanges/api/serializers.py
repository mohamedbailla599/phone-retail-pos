from rest_framework import serializers

from apps.exchanges.models import Exchange
from apps.exchanges.models import Exchange
from apps.payments.models import Payment
from apps.refunds.models import Refund
from apps.sales.models import Transaction

class ExchangeSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(
        source="customer.full_name",
        read_only=True,
    )
    customer_phone = serializers.CharField(
        source="customer.phone_number",
        read_only=True,
    )

    original_receipt_id = serializers.CharField(
        source="original_transaction.receipt_id",
        read_only=True,
    )

    old_device_imei_1 = serializers.CharField(
        source="old_device.imei_1",
        read_only=True,
    )
    old_device_serial_number = serializers.CharField(
        source="old_device.serial_number",
        read_only=True,
    )

    new_device_imei_1 = serializers.CharField(
        source="new_device.imei_1",
        read_only=True,
    )
    new_device_serial_number = serializers.CharField(
        source="new_device.serial_number",
        read_only=True,
    )

    reviewed_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Exchange
        fields = [
            "id",
            "exchange_number",

            # Relations
            "customer",
            "customer_name",
            "customer_phone",

            "original_transaction",
            "original_receipt_id",

            "old_device",
            "old_device_imei_1",
            "old_device_serial_number",

            "new_device",
            "new_device_imei_1",
            "new_device_serial_number",

            # Financial information
            "old_device_value",
            "new_device_price",
            "difference_amount",
            "financial_direction",

            # Lifecycle
            "status",
            "reason",
            "owner_notes",

            # Actors / timestamps
            "requested_at",
            "reviewed_at",
            "reviewed_by",
            "reviewed_by_name",

            "approved_at",
            "approved_by",
            "approved_by_name",

            "completed_at",
            "completed_by",
            "completed_by_name",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "exchange_number",
            "difference_amount",
            "financial_direction",

            "reviewed_at",
            "reviewed_by",
            "approved_at",
            "approved_by",
            "completed_at",
            "completed_by",

            "requested_at",
            "created_at",
            "updated_at",
        ]

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return None
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username

    def get_approved_by_name(self, obj):
        if not obj.approved_by:
            return None
        return obj.approved_by.get_full_name() or obj.approved_by.username

    def get_completed_by_name(self, obj):
        if not obj.completed_by:
            return None
        return obj.completed_by.get_full_name() or obj.completed_by.username


class CreateExchangeSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    original_transaction_id = serializers.IntegerField()
    old_device_id = serializers.IntegerField()
    new_device_id = serializers.IntegerField()

    old_device_value = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
    )

    new_device_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
    )

    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )


class CreateExchangePaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
    )
    method = serializers.ChoiceField(
        choices=Payment.Method.choices,
    )
    reference = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )


class ExchangePaymentSerializer(serializers.ModelSerializer):
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
            "rejected_at",
        ]
        read_only_fields = fields


class ExchangeTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = [
            "id",
            "receipt_id",
            "total_amount",
            "status",
        ]
        read_only_fields = fields


class ExchangePaymentResponseSerializer(serializers.Serializer):
    exchange_id = serializers.IntegerField()
    payment = ExchangePaymentSerializer()
    transaction = ExchangeTransactionSerializer()


class ExchangePaymentStatusSerializer(serializers.Serializer):
    exchange_id = serializers.IntegerField()
    transaction = ExchangeTransactionSerializer(
        allow_null=True,
    )
    confirmed_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    fully_paid = serializers.BooleanField()


class CreateExchangeRefundSerializer(serializers.Serializer):
    method = serializers.ChoiceField(
        choices=Refund.Method.choices,
    )
    reference = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )


class ExchangeRefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refund
        fields = [
            "id",
            "refund_number",
            "amount",
            "method",
            "status",
            "reference",
            "reason",
            "notes",
            "requested_at",
            "approved_at",
            "completed_at",
        ]
        read_only_fields = fields


class ExchangeRefundResponseSerializer(serializers.Serializer):
    exchange_id = serializers.IntegerField()
    refund = ExchangeRefundSerializer()


class CompleteExchangeRefundResponseSerializer(serializers.Serializer):
    refund = ExchangeRefundSerializer()