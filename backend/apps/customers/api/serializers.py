from rest_framework import serializers
from apps.customers.models import Customer, CustomerDebtPayment


class CustomerDebtPaymentSerializer(serializers.ModelSerializer):
    operator_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomerDebtPayment
        fields = [
            'id',
            'amount',
            'payment_method',
            'notes',
            'operator_name',
            'created_at',
        ]

    def get_operator_name(self, obj):
        if obj.operator:
            return obj.operator.get_full_name() or obj.operator.username
        return "Boutique"


class CustomerSerializer(serializers.ModelSerializer):
    transactions_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Customer
        fields = [
            'id',
            'full_name',
            'phone_number',
            'notes',
            'address',
            'current_debt',
            'credit_limit',
            'total_spent',
            'transactions_count',
            'created_at',
            'updated_at',
        ]


class CustomerDetailSerializer(serializers.ModelSerializer):
    debt_payments = CustomerDebtPaymentSerializer(many=True, read_only=True)
    recent_transactions = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id',
            'full_name',
            'phone_number',
            'notes',
            'address',
            'current_debt',
            'credit_limit',
            'total_spent',
            'debt_payments',
            'recent_transactions',
            'created_at',
            'updated_at',
        ]

    def get_recent_transactions(self, obj):
        txs = obj.transactions.order_by('-created_at')[:10]
        return [
            {
                'id': t.id,
                'receipt_id': t.receipt_id,
                'transaction_type': t.transaction_type,
                'status': t.status,
                'total_amount': str(t.total_amount),
                'created_at': t.created_at.isoformat(),
            }
            for t in txs
        ]
