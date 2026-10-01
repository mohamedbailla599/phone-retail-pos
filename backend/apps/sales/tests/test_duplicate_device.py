from decimal import Decimal

from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.inventory.models import DeviceItem
from apps.sales.models import Transaction, TransactionItem
from apps.sales.services.sales import add_device_to_sale
from core.exceptions import InvalidSaleItem

from .base import SalesTestCase


class DuplicateDeviceTests(SalesTestCase):

    def test_same_device_cannot_be_added_twice(self):
        category = Category.objects.create(
            name="Duplicate Device Test Category",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku="DUP-DEVICE-001",
            name="Duplicate Device Test Phone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=128,
            is_active=True,
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1="123456789001",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5000.00"),
            minimum_selling_price=Decimal("4500.00"),
            battery_health=95,
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )

        sale = Transaction.objects.create(
            receipt_id="BP-DUP-DEVICE-001",
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.DRAFT,
            created_by=self.owner,
        )

        # First addition must succeed.
        add_device_to_sale(
            sale_id=sale.id,
            device_id=device.id,
            actor=self.owner,
            price_sold=Decimal("4800.00"),
        )

        before_count = TransactionItem.objects.filter(
            transaction=sale,
            device=device,
        ).count()

        self.assertEqual(before_count, 1)

        # Second addition of the same device must fail.
        with self.assertRaises(InvalidSaleItem):
            add_device_to_sale(
                sale_id=sale.id,
                device_id=device.id,
                actor=self.owner,
                price_sold=Decimal("4800.00"),
            )

        after_count = TransactionItem.objects.filter(
            transaction=sale,
            device=device,
        ).count()

        self.assertEqual(after_count, 1)