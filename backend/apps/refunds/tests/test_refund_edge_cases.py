from decimal import Decimal

from apps.payments.models import Payment
from apps.payments.services.payments import (
    create_payment,
    reject_bank_transfer,
)
from apps.refunds.models import Refund, RefundPaymentAllocation
from apps.refunds.services.refunds import (
    approve_refund,
    complete_refund,
    create_refund,
)

from .base import RefundTestCase


class RefundEdgeCasesTest(RefundTestCase):

    def _create_refund(
        self,
        return_record,
        customer,
        amount,
    ):
        return create_refund(
            customer=customer,
            source_type=Refund.SourceType.RETURN,
            source_id=return_record.id,
            amount=amount,
            method=Refund.Method.CASH,
            reason="Refund edge case test",
            actor=self.owner,
        )

    def _approve_complete(self, refund):
        refund = approve_refund(
            refund_id=refund.id,
            actor=self.owner,
        )

        return complete_refund(
            refund_id=refund.id,
            actor=self.owner,
        )

    def test_refund_greater_than_confirmed_payments(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("500.00"),
        )

        self.create_confirmed_cash_payment(
            transaction,
            Decimal("300.00"),
        )

        self.complete_transaction(transaction)

        return_record = self.create_return(
            transaction,
            customer,
            Decimal("500.00"),
        )

        with self.assertRaises(ValueError):
            self._create_refund(
                return_record,
                customer,
                Decimal("500.00"),
            )

    def test_refund_greater_than_return_amount(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("500.00"),
        )

        self.create_confirmed_cash_payment(
            transaction,
            Decimal("500.00"),
        )

        self.complete_transaction(transaction)

        return_record = self.create_return(
            transaction,
            customer,
            Decimal("300.00"),
        )

        with self.assertRaises(ValueError):
            self._create_refund(
                return_record,
                customer,
                Decimal("500.00"),
            )

    def test_refund_without_confirmed_payments(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("500.00"),
        )

        self.complete_transaction(transaction)

        return_record = self.create_return(
            transaction,
            customer,
            Decimal("500.00"),
        )

        with self.assertRaises(ValueError):
            self._create_refund(
                return_record,
                customer,
                Decimal("500.00"),
            )

    def test_pending_bank_transfer_is_not_refundable(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("500.00"),
        )

        payment = create_payment(
            sale_id=transaction.id,
            amount=Decimal("500.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
            reference="PENDING-TEST",
        )

        payment.refresh_from_db()

        self.assertEqual(
            payment.status,
            Payment.Status.PENDING,
        )

        self.complete_transaction(transaction)

        return_record = self.create_return(
            transaction,
            customer,
            Decimal("500.00"),
        )

        with self.assertRaises(ValueError):
            self._create_refund(
                return_record,
                customer,
                Decimal("500.00"),
            )

    def test_rejected_payment_is_not_refundable(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("500.00"),
        )

        payment = create_payment(
            sale_id=transaction.id,
            amount=Decimal("500.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
            reference="REJECT-TEST",
        )

        reject_bank_transfer(
            payment_id=payment.id,
            actor=self.owner,
        )

        payment.refresh_from_db()

        self.assertEqual(
            payment.status,
            Payment.Status.REJECTED,
        )

        self.complete_transaction(transaction)

        return_record = self.create_return(
            transaction,
            customer,
            Decimal("500.00"),
        )

        with self.assertRaises(ValueError):
            self._create_refund(
                return_record,
                customer,
                Decimal("500.00"),
            )

    def test_allocation_exhaustion_blocks_second_refund(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("1000.00"),
        )

        payment = self.create_confirmed_cash_payment(
            transaction,
            Decimal("1000.00"),
        )

        self.complete_transaction(transaction)

        return_one = self.create_return(
            transaction,
            customer,
            Decimal("1000.00"),
        )

        refund_one = self._create_refund(
            return_one,
            customer,
            Decimal("1000.00"),
        )

        refund_one = self._approve_complete(refund_one)

        payment.refresh_from_db()

        self.assertEqual(
            payment.status,
            Payment.Status.REFUNDED,
        )

        return_two = self.create_return(
            transaction,
            customer,
            Decimal("1.00"),
        )

        with self.assertRaises(ValueError):
            self._create_refund(
                return_two,
                customer,
                Decimal("1.00"),
            )

    def test_completed_refund_cannot_be_completed_twice(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("500.00"),
        )

        self.create_confirmed_cash_payment(
            transaction,
            Decimal("500.00"),
        )

        self.complete_transaction(transaction)

        return_record = self.create_return(
            transaction,
            customer,
            Decimal("500.00"),
        )

        refund = self._create_refund(
            return_record,
            customer,
            Decimal("500.00"),
        )

        refund = self._approve_complete(refund)

        self.assertEqual(
            refund.status,
            Refund.Status.COMPLETED,
        )

        with self.assertRaises(ValueError):
            complete_refund(
                refund_id=refund.id,
                actor=self.owner,
            )

    def test_single_payment_gets_one_allocation(self):
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

        refund = self._create_refund(
            return_record,
            customer,
            Decimal("500.00"),
        )

        refund = self._approve_complete(refund)

        allocation_count = (
            RefundPaymentAllocation.objects
            .filter(
                refund=refund,
                payment=payment,
            )
            .count()
        )

        self.assertEqual(
            allocation_count,
            1,
        )

    def test_multiple_refunds_from_same_sale(self):
        customer = self.create_customer()

        transaction = self.create_transaction(
            customer,
            Decimal("1000.00"),
        )

        payment = self.create_confirmed_cash_payment(
            transaction,
            Decimal("1000.00"),
        )

        self.complete_transaction(transaction)

        return_one = self.create_return(
            transaction,
            customer,
            Decimal("400.00"),
        )

        return_two = self.create_return(
            transaction,
            customer,
            Decimal("600.00"),
        )

        refund_one = self._create_refund(
            return_one,
            customer,
            Decimal("400.00"),
        )

        refund_one = self._approve_complete(refund_one)

        refund_two = self._create_refund(
            return_two,
            customer,
            Decimal("600.00"),
        )

        refund_two = self._approve_complete(refund_two)

        payment.refresh_from_db()

        self.assertEqual(
            refund_one.status,
            Refund.Status.COMPLETED,
        )

        self.assertEqual(
            refund_two.status,
            Refund.Status.COMPLETED,
        )

        self.assertEqual(
            payment.status,
            Payment.Status.REFUNDED,
        )