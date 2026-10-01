from decimal import Decimal

from django.test import TestCase

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.exchanges.models import Exchange
from apps.exchanges.services.exchanges import (
    approve_exchange,
    create_exchange,
    submit_exchange_for_review,
)
from apps.exchanges.services.settlement import (
    create_exchange_payment,
    create_exchange_refund,
    get_exchange_payment_status,
)
from apps.inventory.models import DeviceItem
from apps.payments.models import Payment
from apps.refunds.models import Refund
from apps.sales.models import Transaction, TransactionItem
from apps.users.models import User


class ExchangeSettlementTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="settlement_owner",
            password="testpass123",
            role=User.Role.OWNER,
        )

        cls.customer = Customer.objects.create(
            phone_number="0600000002",
            full_name="Settlement Customer",
        )

        cls.category = Category.objects.create(
            name="Settlement Smartphones",
            is_device=True,
        )

        cls.old_product = Product.objects.create(
            category=cls.category,
            sku="SET-OLD-IP",
            name="Old iPhone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=128,
            is_active=True,
        )

        cls.new_product = Product.objects.create(
            category=cls.category,
            sku="SET-NEW-IP",
            name="New iPhone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=256,
            is_active=True,
        )

    def _create_device(
        self,
        *,
        product,
        imei,
        status,
        selling="4000.00",
    ):
        return DeviceItem.objects.create(
            product=product,
            imei_1=imei,
            cost_price=Decimal("3000.00"),
            default_selling_price=Decimal(selling),
            minimum_selling_price=Decimal("3500.00"),
            status=status,
            received_at="2026-09-30T10:00:00Z",
        )

    def _create_completed_sale(self, old_device):
        sale = Transaction.objects.create(
            receipt_id=f"BP-SET-SALE-{old_device.id}",
            customer=self.customer,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.COMPLETED,
            subtotal=Decimal("4000.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("4000.00"),
            created_by=self.owner,
        )

        TransactionItem.objects.create(
            transaction=sale,
            device=old_device,
            product_name_snapshot=old_device.product.name,
            sku_snapshot=old_device.product.sku,
            quantity=1,
            unit_price=Decimal("4000.00"),
            price_sold=Decimal("4000.00"),
            line_total=Decimal("4000.00"),
            cost_price_at_sale=old_device.cost_price,
        )

        return sale

    def _approve_exchange(
        self,
        *,
        old_device,
        new_device,
        old_value,
        new_price,
    ):
        sale = self._create_completed_sale(old_device)

        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal(old_value),
            new_device_price=Decimal(new_price),
            actor=self.owner,
        )

        submit_exchange_for_review(
            exchange_id=exchange.id,
            actor=self.owner,
        )

        approve_exchange(
            exchange_id=exchange.id,
            actor=self.owner,
        )

        exchange.refresh_from_db()

        return exchange

    # ========================================================
    # CUSTOMER PAYS — CASH
    # ========================================================

    def test_customer_pays_cash(self):
        old_device = self._create_device(
            product=self.old_product,
            imei="211111111111111",
            status=DeviceItem.Status.SOLD,
        )

        new_device = self._create_device(
            product=self.new_product,
            imei="222222222222222",
            status=DeviceItem.Status.IN_STOCK,
            selling="5500.00",
        )

        exchange = self._approve_exchange(
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
            Transaction.TransactionType.EXCHANGE,
        )

        self.assertEqual(
            transaction_obj.status,
            Transaction.Status.PENDING_PAYMENT,
        )

        self.assertEqual(
            payment.status,
            Payment.Status.CONFIRMED,
        )

        self.assertEqual(
            payment.amount,
            Decimal("1500.00"),
        )

    # ========================================================
    # CUSTOMER PAYS — BANK TRANSFER
    # ========================================================

    def test_customer_pays_bank_transfer_starts_pending(self):
        old_device = self._create_device(
            product=self.old_product,
            imei="233333333333333",
            status=DeviceItem.Status.SOLD,
        )

        new_device = self._create_device(
            product=self.new_product,
            imei="244444444444444",
            status=DeviceItem.Status.IN_STOCK,
        )

        exchange = self._approve_exchange(
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

        self.assertEqual(
            transaction_obj.status,
            Transaction.Status.PENDING_PAYMENT,
        )

        self.assertEqual(
            payment.status,
            Payment.Status.PENDING,
        )

        self.assertEqual(
            payment.reference,
            "BANK-EX-001",
        )

    # ========================================================
    # WRONG PAYMENT AMOUNT
    # ========================================================

    def test_customer_payment_must_match_difference(self):
        old_device = self._create_device(
            product=self.old_product,
            imei="255555555555555",
            status=DeviceItem.Status.SOLD,
        )

        new_device = self._create_device(
            product=self.new_product,
            imei="266666666666666",
            status=DeviceItem.Status.IN_STOCK,
        )

        exchange = self._approve_exchange(
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

    # ========================================================
    # DUPLICATE PAYMENT
    # ========================================================

    def test_exchange_cannot_have_two_financial_transactions(self):
        old_device = self._create_device(
            product=self.old_product,
            imei="277777777777777",
            status=DeviceItem.Status.SOLD,
        )

        new_device = self._create_device(
            product=self.new_product,
            imei="288888888888888",
            status=DeviceItem.Status.IN_STOCK,
        )

        exchange = self._approve_exchange(
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

    # ========================================================
    # PAYMENT STATUS
    # ========================================================

    def test_exchange_payment_status(self):
        old_device = self._create_device(
            product=self.old_product,
            imei="299999999999999",
            status=DeviceItem.Status.SOLD,
        )

        new_device = self._create_device(
            product=self.new_product,
            imei="300000000000000",
            status=DeviceItem.Status.IN_STOCK,
        )

        exchange = self._approve_exchange(
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

        result = get_exchange_payment_status(
            exchange_id=exchange.id,
        )

        self.assertEqual(
            result["confirmed_amount"],
            Decimal("1000.00"),
        )

        self.assertTrue(
            result["fully_paid"]
        )

    # ========================================================
    # STORE REFUND
    # ========================================================

    def test_store_refund(self):
        old_device = self._create_device(
            product=self.old_product,
            imei="311111111111111",
            status=DeviceItem.Status.SOLD,
        )

        new_device = self._create_device(
            product=self.new_product,
            imei="322222222222222",
            status=DeviceItem.Status.IN_STOCK,
        )

        exchange = self._approve_exchange(
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

        self.assertEqual(
            refund.source_type,
            Refund.SourceType.EXCHANGE,
        )

        self.assertEqual(
            refund.amount,
            Decimal("1000.00"),
        )

        self.assertEqual(
            refund.status,
            Refund.Status.REQUESTED,
        )

    # ========================================================
    # EVEN EXCHANGE
    # ========================================================

    def test_even_exchange_has_no_payment_or_refund(self):
        old_device = self._create_device(
            product=self.old_product,
            imei="333333333333333",
            status=DeviceItem.Status.SOLD,
        )

        new_device = self._create_device(
            product=self.new_product,
            imei="344444444444444",
            status=DeviceItem.Status.IN_STOCK,
        )

        exchange = self._approve_exchange(
            old_device=old_device,
            new_device=new_device,
            old_value="4000.00",
            new_price="4000.00",
        )

        self.assertEqual(
            exchange.difference_amount,
            Decimal("0.00"),
        )

        self.assertEqual(
            exchange.financial_direction,
            Exchange.FinancialDirection.EVEN,
        )