from decimal import Decimal

from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import (
    AccessoryStock,
    DeviceItem,
    StockMovement,
)
from apps.payments.models import Payment
from apps.payments.services.payments import create_payment
from apps.sales.models import Transaction
from apps.sales.services.sales import (
    add_accessory_to_sale,
    add_device_to_sale,
    complete_sale,
    create_sale,
    move_sale_to_pending_payment,
)
from core.exceptions import (
    DeviceNotAvailable,
    InsufficientAccessoryStock,
    InsufficientPayment,
)

from .base import SalesTestCase


class CompleteSaleTests(SalesTestCase):

    def test_complete_cash_device_sale(self):
        category = Category.objects.create(
            name="Payment Test Category",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku="TEST-COMPLETE-DEVICE-001",
            name="Complete Sale Test Phone",
            brand="TEST",
            platform="ANDROID",
            storage_gb=128,
            ram_gb=8,
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1="CMP1-000000001",
            cost_price=Decimal("3000.00"),
            default_selling_price=Decimal("4000.00"),
            minimum_selling_price=Decimal("3500.00"),
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )

        customer = Customer.objects.create(
            phone_number="0600000001",
            full_name="Complete Sale Customer",
        )

        sale = create_sale(
            actor=self.owner,
            customer=customer,
            notes="Complete sale cash test",
        )

        add_device_to_sale(
            sale_id=sale.id,
            device_id=device.id,
            actor=self.owner,
        )

        move_sale_to_pending_payment(
            sale_id=sale.id,
            actor=self.owner,
        )

        sale.refresh_from_db()

        self.assertEqual(
            sale.status,
            Transaction.Status.PENDING_PAYMENT,
        )
        self.assertEqual(
            sale.total_amount,
            Decimal("4000.00"),
        )

        # Inventory is untouched before completion.
        device.refresh_from_db()
        self.assertEqual(
            device.status,
            DeviceItem.Status.IN_STOCK,
        )

        payment = create_payment(
            sale_id=sale.id,
            amount=Decimal("4000.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )

        self.assertEqual(
            payment.status,
            Payment.Status.CONFIRMED,
        )

        completed_sale = complete_sale(
            sale_id=sale.id,
            actor=self.owner,
        )

        completed_sale.refresh_from_db()
        device.refresh_from_db()
        customer.refresh_from_db()

        self.assertEqual(
            completed_sale.status,
            Transaction.Status.COMPLETED,
        )
        self.assertIsNotNone(completed_sale.completed_at)

        self.assertEqual(
            device.status,
            DeviceItem.Status.SOLD,
        )

        self.assertEqual(
            customer.total_spent,
            Decimal("4000.00"),
        )

        item = completed_sale.items.get()

        self.assertIsNotNone(item.warranty_start)
        self.assertIsNotNone(item.warranty_end)

        movement = (
            StockMovement.objects
            .filter(
                device=device,
                reference_type="Transaction",
                reference_id=str(sale.id),
            )
            .order_by("-id")
            .first()
        )

        self.assertIsNotNone(movement)
        self.assertEqual(
            movement.movement_type,
            StockMovement.MovementType.SOLD,
        )
        self.assertEqual(movement.quantity, 1)

    def test_insufficient_payment_blocks_sale_completion(self):
        category = Category.objects.create(
            name="Insufficient Payment Category",
            is_device=False,
        )

        product = Product.objects.create(
            category=category,
            sku="TEST-COMPLETE-ACC-001",
            name="Insufficient Payment Accessory",
            brand="TEST",
        )

        stock = AccessoryStock.objects.create(
            product=product,
            cost_price=Decimal("50.00"),
            selling_price=Decimal("100.00"),
            quantity=10,
            reorder_level=2,
        )

        sale = create_sale(
            actor=self.owner,
            notes="Insufficient payment test",
        )

        add_accessory_to_sale(
            sale_id=sale.id,
            accessory_stock_id=stock.id,
            quantity=1,
            actor=self.owner,
        )

        move_sale_to_pending_payment(
            sale_id=sale.id,
            actor=self.owner,
        )

        create_payment(
            sale_id=sale.id,
            amount=Decimal("50.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )

        with self.assertRaises(InsufficientPayment):
            complete_sale(
                sale_id=sale.id,
                actor=self.owner,
            )

        sale.refresh_from_db()
        stock.refresh_from_db()

        self.assertEqual(
            sale.status,
            Transaction.Status.PENDING_PAYMENT,
        )
        self.assertEqual(stock.quantity, 10)

    def test_unavailable_device_blocks_sale_completion(self):
        category = Category.objects.create(
            name="Unavailable Device Category",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku="TEST-COMPLETE-DEVICE-002",
            name="Unavailable Test Phone",
            brand="TEST",
            platform="ANDROID",
            storage_gb=256,
            ram_gb=12,
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1="CMP2-000000001",
            cost_price=Decimal("5000.00"),
            default_selling_price=Decimal("6000.00"),
            minimum_selling_price=Decimal("5500.00"),
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )

        sale = create_sale(
            actor=self.owner,
            notes="Unavailable device test",
        )

        add_device_to_sale(
            sale_id=sale.id,
            device_id=device.id,
            actor=self.owner,
        )

        move_sale_to_pending_payment(
            sale_id=sale.id,
            actor=self.owner,
        )

        create_payment(
            sale_id=sale.id,
            amount=Decimal("6000.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )

        # Simulate another operation taking the device.
        device.status = DeviceItem.Status.REPAIR
        device.save(update_fields=["status", "updated_at"])

        with self.assertRaises(DeviceNotAvailable):
            complete_sale(
                sale_id=sale.id,
                actor=self.owner,
            )

        sale.refresh_from_db()
        device.refresh_from_db()

        self.assertEqual(
            sale.status,
            Transaction.Status.PENDING_PAYMENT,
        )
        self.assertEqual(
            device.status,
            DeviceItem.Status.REPAIR,
        )

    def test_insufficient_accessory_stock_blocks_sale_completion(self):
        category = Category.objects.create(
            name="Insufficient Stock Category",
            is_device=False,
        )

        product = Product.objects.create(
            category=category,
            sku="TEST-COMPLETE-ACC-002",
            name="Insufficient Stock Accessory",
            brand="TEST",
        )

        stock = AccessoryStock.objects.create(
            product=product,
            cost_price=Decimal("20.00"),
            selling_price=Decimal("100.00"),
            quantity=5,
            reorder_level=1,
        )

        sale = create_sale(
            actor=self.owner,
            notes="Insufficient stock completion test",
        )

        add_accessory_to_sale(
            sale_id=sale.id,
            accessory_stock_id=stock.id,
            quantity=3,
            actor=self.owner,
        )

        move_sale_to_pending_payment(
            sale_id=sale.id,
            actor=self.owner,
        )

        create_payment(
            sale_id=sale.id,
            amount=Decimal("300.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )

        # Simulate another sale consuming stock.
        stock.quantity = 2
        stock.save(update_fields=["quantity", "updated_at"])

        with self.assertRaises(InsufficientAccessoryStock):
            complete_sale(
                sale_id=sale.id,
                actor=self.owner,
            )

        sale.refresh_from_db()
        stock.refresh_from_db()

        self.assertEqual(
            sale.status,
            Transaction.Status.PENDING_PAYMENT,
        )
        self.assertEqual(stock.quantity, 2)

    def test_complimentary_accessory_sale_completion(self):
        category = Category.objects.create(
            name="Complimentary Completion Category",
            is_device=False,
        )

        product = Product.objects.create(
            category=category,
            sku="TEST-COMPLETE-COMPLIMENTARY-001",
            name="Complimentary Case",
            brand="TEST",
        )

        stock = AccessoryStock.objects.create(
            product=product,
            cost_price=Decimal("20.00"),
            selling_price=Decimal("100.00"),
            quantity=5,
            reorder_level=1,
        )

        sale = create_sale(
            actor=self.owner,
            notes="Complimentary accessory completion test",
        )

        add_accessory_to_sale(
            sale_id=sale.id,
            accessory_stock_id=stock.id,
            quantity=2,
            actor=self.owner,
            is_complimentary=True,
        )

        move_sale_to_pending_payment(
            sale_id=sale.id,
            actor=self.owner,
        )

        sale.refresh_from_db()

        self.assertEqual(
            sale.total_amount,
            Decimal("0.00"),
        )

        # No payment is required for a zero-value sale.
        completed_sale = complete_sale(
            sale_id=sale.id,
            actor=self.owner,
        )

        completed_sale.refresh_from_db()
        stock.refresh_from_db()

        self.assertEqual(
            completed_sale.status,
            Transaction.Status.COMPLETED,
        )
        self.assertEqual(stock.quantity, 3)

        item = completed_sale.items.get()

        self.assertTrue(item.is_complimentary)
        self.assertEqual(
            item.price_sold,
            Decimal("0.00"),
        )
        self.assertEqual(
            item.line_total,
            Decimal("0.00"),
        )

        movement = (
            StockMovement.objects
            .filter(
                accessory_stock=stock,
                reference_type="Transaction",
                reference_id=str(sale.id),
            )
            .order_by("-id")
            .first()
        )

        self.assertIsNotNone(movement)
        self.assertEqual(
            movement.movement_type,
            StockMovement.MovementType.COMPLIMENTARY,
        )
        self.assertEqual(movement.quantity, -2)