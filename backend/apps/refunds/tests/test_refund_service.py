from decimal import Decimal

from apps.payments.models import Payment
from apps.refunds.models import Refund, RefundPaymentAllocation
from apps.refunds.services.refunds import (
    approve_refund,
    complete_refund,
    create_refund,
)
from apps.returns.models import Return

from .base import RefundTestCase


class RefundServiceTest(RefundTestCase):

    def test_create_approve_complete_refund(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("500.00"),
        )

        payment = self.create_confirmed_cash_payment(
            transaction,
            Decimal("500.00"),
        )

        self.complete_transaction(transaction)

        return_record = self.create_return(
            transaction,
            customer,
            Decimal("500.00"),
        )

        refund = create_refund(
            customer=customer,
            source_type=Refund.SourceType.RETURN,
            source_id=return_record.id,
            amount=Decimal("500.00"),
            method=Refund.Method.CASH,
            reason="Test return refund",
            actor=self.owner,
        )

        self.assertEqual(
            refund.status,
            Refund.Status.REQUESTED,
        )

        self.assertEqual(
            refund.amount,
            Decimal("500.00"),
        )

        self.assertEqual(
            refund.method,
            Refund.Method.CASH,
        )

        self.assertEqual(
            refund.source_type,
            Refund.SourceType.RETURN,
        )

        self.assertEqual(
            refund.source_id,
            return_record.id,
        )

        refund = approve_refund(
            refund_id=refund.id,
            actor=self.owner,
        )

        self.assertEqual(
            refund.status,
            Refund.Status.APPROVED,
        )

        self.assertEqual(
            refund.approved_by_id,
            self.owner.id,
        )

        self.assertIsNotNone(
            refund.approved_at,
        )

        refund = complete_refund(
            refund_id=refund.id,
            actor=self.owner,
        )

        refund.refresh_from_db()
        payment.refresh_from_db()
        return_record.refresh_from_db()

        self.assertEqual(
            refund.status,
            Refund.Status.COMPLETED,
        )

        self.assertEqual(
            refund.completed_by_id,
            self.owner.id,
        )

        self.assertIsNotNone(
            refund.completed_at,
        )

        self.assertEqual(
            return_record.status,
            Return.Status.REFUNDED,
        )

        self.assertIsNotNone(
            return_record.completed_at,
        )

        allocation = RefundPaymentAllocation.objects.get(
            refund=refund,
            payment=payment,
        )

        self.assertEqual(
            allocation.amount,
            Decimal("500.00"),
        )

        self.assertEqual(
            allocation.payment_id,
            payment.id,
        )

        self.assertEqual(
            allocation.refund_id,
            refund.id,
        )

        self.assertEqual(
            payment.status,
            Payment.Status.REFUNDED,
        )

        # Completed refund cannot be approved again.
        with self.assertRaises(ValueError):
            approve_refund(
                refund_id=refund.id,
                actor=self.owner,
            )

        # Same return cannot receive another refund.
        with self.assertRaises(ValueError):
            create_refund(
                customer=customer,
                source_type=Refund.SourceType.RETURN,
                source_id=return_record.id,
                amount=Decimal("500.00"),
                method=Refund.Method.CASH,
                reason="Duplicate refund test",
                actor=self.owner,
            )