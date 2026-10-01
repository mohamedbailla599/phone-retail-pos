from decimal import Decimal
from uuid import uuid4

from django.test import TestCase

from apps.customers.models import Customer
from apps.payments.models import Payment
from apps.payments.services.payments import create_payment
from apps.returns.models import Return
from apps.sales.models import Transaction
from apps.store_settings.models import StoreSettings
from apps.users.models import User


class RefundTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username=f"refund_test_{uuid4().hex[:8]}",
            password="test123",
            role=User.Role.OWNER,
        )

        self.store_settings = StoreSettings.objects.create(
            store_name="Bighrissen Phone",
            currency="MAD",
            default_device_warranty_months=1,
            default_reservation_months=1,
            default_accessory_warranty_months=0,
            receipt_prefix="BP",
            updated_by=self.owner,
        )

    def create_customer(self, name="Refund Test Customer"):
        suffix = uuid4().hex[:8]

        return Customer.objects.create(
            phone_number=f"06{suffix}",
            full_name=name,
        )

    def create_transaction(self, customer, amount):
        return Transaction.objects.create(
            receipt_id=f"BP-RF-TEST-{uuid4().hex[:8]}",
            customer=customer,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.PENDING_PAYMENT,
            subtotal=amount,
            discount_amount=Decimal("0.00"),
            total_amount=amount,
            created_by=self.owner,
        )

    def complete_transaction(self, transaction):
        transaction.status = Transaction.Status.COMPLETED
        transaction.save(update_fields=["status"])

    def create_return(self, transaction, customer, amount):
        return Return.objects.create(
            return_number=f"BP-RT-TEST-{uuid4().hex[:8]}",
            transaction=transaction,
            customer=customer,
            status=Return.Status.RESTOCKED,
            reason="Refund test",
            total_amount=amount,
            created_by=self.owner,
        )

    def create_confirmed_cash_payment(self, transaction, amount):
        payment = create_payment(
            sale_id=transaction.id,
            amount=amount,
            method=Payment.Method.CASH,
            actor=self.owner,
        )

        payment.refresh_from_db()

        return payment