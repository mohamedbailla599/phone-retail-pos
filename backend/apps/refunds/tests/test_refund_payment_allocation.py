from decimal import Decimal

from apps.payments.models import Payment
from apps.payments.services.payments import (
    confirm_bank_transfer,
    create_payment,
)
from apps.refunds.models import Refund, RefundPaymentAllocation
from apps.refunds.services.refunds import (
    approve_refund,
    complete_refund,
    create_refund,
)

from .base import RefundTestCase


class RefundPaymentAllocationTest(RefundTestCase):

    def test_partial_refund_keeps_payment_confirmed(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("4500.00"),
        )

        payment = self.create_confirmed_cash_payment(
            transaction,
            Decimal("4500.00"),
        )

        self.complete_transaction(transaction)

        return_record = self.create_return(
            transaction,
            customer,
            Decimal("4500.00"),
        )

        refund = create_refund(
            customer=customer,
            source_type=Refund.SourceType.RETURN,
            source_id=return_record.id,
            amount=Decimal("1000.00"),
            method=Refund.Method.CASH,
            reason="Partial refund test",
            actor=self.owner,
        )

        refund = approve_refund(
            refund_id=refund.id,
            actor=self.owner,
        )

        refund = complete_refund(
            refund_id=refund.id,
            actor=self.owner,
        )

        allocation = RefundPaymentAllocation.objects.get(
            refund=refund,
            payment=payment,
        )

        self.assertEqual(
            allocation.amount,
            Decimal("1000.00"),
        )

        payment.refresh_from_db()

        self.assertEqual(
            payment.status,
            Payment.Status.CONFIRMED,
        )

    def test_multiple_payments_allocate_in_creation_order(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("4500.00"),
        )

        cash_payment = self.create_confirmed_cash_payment(
            transaction,
            Decimal("3000.00"),
        )

        bank_payment = create_payment(
            sale_id=transaction.id,
            amount=Decimal("1500.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
        )

        bank_payment = confirm_bank_transfer(
            payment_id=bank_payment.id,
            actor=self.owner,
        )

        cash_payment.refresh_from_db()
        bank_payment.refresh_from_db()

        self.assertEqual(
            cash_payment.status,
            Payment.Status.CONFIRMED,
        )

        self.assertEqual(
            bank_payment.status,
            Payment.Status.CONFIRMED,
        )

        self.complete_transaction(transaction)

        return_record = self.create_return(
            transaction,
            customer,
            Decimal("4500.00"),
        )

        refund = create_refund(
            customer=customer,
            source_type=Refund.SourceType.RETURN,
            source_id=return_record.id,
            amount=Decimal("4000.00"),
            method=Refund.Method.CASH,
            reason="Multiple payment refund test",
            actor=self.owner,
        )

        refund = approve_refund(
            refund_id=refund.id,
            actor=self.owner,
        )

        refund = complete_refund(
            refund_id=refund.id,
            actor=self.owner,
        )

        cash_allocation = RefundPaymentAllocation.objects.get(
            refund=refund,
            payment=cash_payment,
        )

        bank_allocation = RefundPaymentAllocation.objects.get(
            refund=refund,
            payment=bank_payment,
        )

        self.assertEqual(
            cash_allocation.amount,
            Decimal("3000.00"),
        )

        self.assertEqual(
            bank_allocation.amount,
            Decimal("1000.00"),
        )

        self.assertEqual(
            cash_allocation.amount + bank_allocation.amount,
            refund.amount,
        )

        cash_payment.refresh_from_db()
        bank_payment.refresh_from_db()

        self.assertEqual(
            cash_payment.status,
            Payment.Status.REFUNDED,
        )

        self.assertEqual(
            bank_payment.status,
            Payment.Status.CONFIRMED,
        )