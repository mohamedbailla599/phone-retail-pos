from decimal import Decimal

from apps.exchanges.models import Exchange
from apps.exchanges.services.settlement import (
    create_exchange_payment,
    create_exchange_refund,
    get_exchange_payment_status,
)
from apps.inventory.models import DeviceItem
from apps.payments.models import Payment
from apps.refunds.models import Refund
from .base import ExchangeTestCase


class ExchangeSettlementTest(ExchangeTestCase):
    def test_customer_pays_cash(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="211111111111111",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="222222222222222",
            status=DeviceItem.Status.IN_STOCK,
            selling="5500.00",
        )
        exchange = self.approve_exchange(
            old_device=old_device,
            new_device=new_device,
            old_value="4000.00",
            new_price="5500.00",
        )
        transaction_obj, payment = create_exchange_payment(
            exchange_id=exchange.id,
            amount=Decimal("1500.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )
        self.assertEqual(
            transaction_obj.transaction_type,
            transaction_obj.TransactionType.EXCHANGE,
        )
        self.assertEqual(
            transaction_obj.status,
            transaction_obj.Status.PENDING_PAYMENT,
        )
        self.assertEqual(payment.status, Payment.Status.CONFIRMED)
        self.assertEqual(payment.amount, Decimal("1500.00"))

    def test_customer_pays_bank_transfer_starts_pending(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="233333333333333",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="244444444444444",
            status=DeviceItem.Status.IN_STOCK,
        )
        exchange = self.approve_exchange(
            old_device=old_device,
            new_device=new_device,
            old_value="4000.00",
            new_price="5000.00",
        )
        transaction_obj, payment = create_exchange_payment(
            exchange_id=exchange.id,
            amount=Decimal("1000.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
            reference="BANK-EX-001",
        )
        self.assertEqual(transaction_obj.status, transaction_obj.Status.PENDING_PAYMENT)
        self.assertEqual(payment.status, Payment.Status.PENDING)
        self.assertEqual(payment.reference, "BANK-EX-001")

    def test_customer_payment_must_match_difference(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="255555555555555",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="266666666666666",
            status=DeviceItem.Status.IN_STOCK,
        )
        exchange = self.approve_exchange(
            old_device=old_device,
            new_device=new_device,
            old_value="4000.00",
            new_price="5000.00",
        )
        with self.assertRaises(ValueError):
            create_exchange_payment(
                exchange_id=exchange.id,
                amount=Decimal("999.00"),
                method=Payment.Method.CASH,
                actor=self.owner,
            )

    def test_exchange_cannot_have_two_financial_transactions(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="277777777777777",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="288888888888888",
            status=DeviceItem.Status.IN_STOCK,
        )
        exchange = self.approve_exchange(
            old_device=old_device,
            new_device=new_device,
            old_value="4000.00",
            new_price="5000.00",
        )
        create_exchange_payment(
            exchange_id=exchange.id,
            amount=Decimal("1000.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )
        with self.assertRaises(ValueError):
            create_exchange_payment(
                exchange_id=exchange.id,
                amount=Decimal("1000.00"),
                method=Payment.Method.CASH,
                actor=self.owner,
            )

    def test_exchange_payment_status(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="299999999999999",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="300000000000000",
            status=DeviceItem.Status.IN_STOCK,
        )
        exchange = self.approve_exchange(
            old_device=old_device,
            new_device=new_device,
            old_value="4000.00",
            new_price="5000.00",
        )
        create_exchange_payment(
            exchange_id=exchange.id,
            amount=Decimal("1000.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )
        result = get_exchange_payment_status(exchange_id=exchange.id)
        self.assertEqual(result["confirmed_amount"], Decimal("1000.00"))
        self.assertTrue(result["fully_paid"])

    def test_store_refund(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="311111111111111",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="322222222222222",
            status=DeviceItem.Status.IN_STOCK,
        )
        exchange = self.approve_exchange(
            old_device=old_device,
            new_device=new_device,
            old_value="5000.00",
            new_price="4000.00",
        )
        refund = create_exchange_refund(
            exchange_id=exchange.id,
            method=Refund.Method.CASH,
            actor=self.owner,
            reason="Exchange difference refund.",
        )
        self.assertEqual(refund.source_type, Refund.SourceType.EXCHANGE)
        self.assertEqual(refund.amount, Decimal("1000.00"))
        self.assertEqual(refund.status, Refund.Status.REQUESTED)

    def test_even_exchange_has_no_payment_or_refund(self):
        old_device = self.create_device(
            product=self.old_product,
            imei="333333333333333",
            status=DeviceItem.Status.SOLD,
        )
        new_device = self.create_device(
            product=self.new_product,
            imei="344444444444444",
            status=DeviceItem.Status.IN_STOCK,
        )
        exchange = self.approve_exchange(
            old_device=old_device,
            new_device=new_device,
            old_value="4000.00",
            new_price="4000.00",
        )
        self.assertEqual(exchange.difference_amount, Decimal("0.00"))
        self.assertEqual(
            exchange.financial_direction,
            Exchange.FinancialDirection.EVEN,
        )
