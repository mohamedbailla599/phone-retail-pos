from decimal import Decimal

from apps.payments.models import Payment
from apps.payments.services.payments import create_payment
from apps.sales.models import Transaction
from core.exceptions import InvalidPayment

from .base import PaymentTestCase


class PaymentCreationTest(PaymentTestCase):
    def test_payment_creation(self):
        sale, stock = self.create_sale_with_accessories(quantity=10)

        self.assertEqual(
            sale.status,
            Transaction.Status.PENDING_PAYMENT,
        )
        self.assertEqual(
            sale.total_amount,
            Decimal("1000.00"),
        )
        self.assertEqual(stock.quantity, 10)

        cash_payment = create_payment(
            sale_id=sale.id,
            amount=Decimal("400.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )

        cash_payment.refresh_from_db()

        self.assertEqual(cash_payment.amount, Decimal("400.00"))
        self.assertEqual(cash_payment.method, Payment.Method.CASH)
        self.assertEqual(
            cash_payment.status,
            Payment.Status.CONFIRMED,
        )
        self.assertEqual(
            cash_payment.confirmed_by_id,
            self.owner.id,
        )
        self.assertIsNotNone(cash_payment.confirmed_at)

        bank_payment = create_payment(
            sale_id=sale.id,
            amount=Decimal("600.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
            reference="BANK-TEST-001",
        )

        bank_payment.refresh_from_db()

        self.assertEqual(bank_payment.amount, Decimal("600.00"))
        self.assertEqual(
            bank_payment.method,
            Payment.Method.BANK_TRANSFER,
        )
        self.assertEqual(
            bank_payment.status,
            Payment.Status.PENDING,
        )
        self.assertIsNone(bank_payment.confirmed_by)
        self.assertIsNone(bank_payment.confirmed_at)
        self.assertEqual(
            bank_payment.reference,
            "BANK-TEST-001",
        )

        with self.assertRaises(InvalidPayment):
            create_payment(
                sale_id=sale.id,
                amount=Decimal("1.00"),
                method=Payment.Method.CASH,
                actor=self.owner,
            )

        sale2, _ = self.create_sale_with_accessories(quantity=1)

        with self.assertRaises(InvalidPayment):
            create_payment(
                sale_id=sale2.id,
                amount=Decimal("101.00"),
                method=Payment.Method.CASH,
                actor=self.owner,
            )

        from apps.sales.services.sales import create_sale

        draft_sale = create_sale(
            actor=self.owner,
            notes="Draft payment test",
        )

        with self.assertRaises(InvalidPayment):
            create_payment(
                sale_id=draft_sale.id,
                amount=Decimal("50.00"),
                method=Payment.Method.CASH,
                actor=self.owner,
            )

        stock.refresh_from_db()
        self.assertEqual(stock.quantity, 10)