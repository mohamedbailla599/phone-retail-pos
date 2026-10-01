from decimal import Decimal

from apps.payments.models import Payment
from apps.payments.services.payments import (
    confirm_bank_transfer,
    create_payment,
    reject_bank_transfer,
)
from apps.sales.models import Transaction
from core.exceptions import PaymentAlreadyProcessed

from .base import PaymentTestCase


class BankTransferProcessingTest(PaymentTestCase):
    def test_bank_transfer_confirmation_and_rejection(self):
        sale, stock = self.create_sale_with_accessories(quantity=10)

        payment = create_payment(
            sale_id=sale.id,
            amount=Decimal("1000.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
            reference="BANK-CONFIRM-001",
        )

        payment.refresh_from_db()

        self.assertEqual(
            payment.status,
            Payment.Status.PENDING,
        )
        self.assertIsNone(payment.confirmed_by)
        self.assertIsNone(payment.confirmed_at)
        self.assertIsNone(payment.rejected_at)

        payment = confirm_bank_transfer(
            payment_id=payment.id,
            actor=self.owner,
        )

        payment.refresh_from_db()
        sale.refresh_from_db()
        stock.refresh_from_db()

        self.assertEqual(
            payment.status,
            Payment.Status.CONFIRMED,
        )
        self.assertEqual(
            payment.confirmed_by_id,
            self.owner.id,
        )
        self.assertIsNotNone(payment.confirmed_at)

        self.assertEqual(
            sale.status,
            Transaction.Status.PENDING_PAYMENT,
        )
        self.assertEqual(stock.quantity, 10)

        with self.assertRaises(PaymentAlreadyProcessed):
            confirm_bank_transfer(
                payment_id=payment.id,
                actor=self.owner,
            )

        sale2, _ = self.create_sale_with_accessories(quantity=1)

        payment2 = create_payment(
            sale_id=sale2.id,
            amount=Decimal("100.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
            reference="BANK-REJECT-001",
        )

        payment2 = reject_bank_transfer(
            payment_id=payment2.id,
            actor=self.owner,
        )

        payment2.refresh_from_db()
        sale2.refresh_from_db()
        stock.refresh_from_db()

        self.assertEqual(
            payment2.status,
            Payment.Status.REJECTED,
        )
        self.assertIsNotNone(payment2.rejected_at)
        self.assertIsNone(payment2.confirmed_by)
        self.assertIsNone(payment2.confirmed_at)

        self.assertEqual(
            sale2.status,
            Transaction.Status.PENDING_PAYMENT,
        )

        self.assertEqual(stock.quantity, 10)

        with self.assertRaises(PaymentAlreadyProcessed):
            reject_bank_transfer(
                payment_id=payment2.id,
                actor=self.owner,
            )