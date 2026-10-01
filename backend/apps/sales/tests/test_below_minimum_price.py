from decimal import Decimal

from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.inventory.models import DeviceItem
from apps.sales.models import Transaction, TransactionItem
from apps.sales.services.sales import add_device_to_sale
from core.exceptions import PriceBelowMinimum

from .base import SalesTestCase


class BelowMinimumPriceTests(SalesTestCase):

    def test_device_below_minimum_price_is_rejected(self):
        category = Category.objects.create(
            name="Below Minimum Test Category",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku="IP13-BELOW-MIN-001",
            name="iPhone 13 Below Minimum",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=128,
            is_active=True,
        )

        first_device = DeviceItem.objects.create(
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

        second_device = DeviceItem.objects.create(
            product=product,
            imei_1="987654321001",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5000.00"),
            minimum_selling_price=Decimal("4500.00"),
            battery_health=95,
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )

        sale = Transaction.objects.create(
            receipt_id="BP-BELOW-MIN-001",
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.DRAFT,
            created_by=self.owner,
        )

        # Valid device must be accepted.
        add_device_to_sale(
            sale_id=sale.id,
            device_id=first_device.id,
            actor=self.owner,
            price_sold=Decimal("4800.00"),
        )

        sale.refresh_from_db()

        before_items = TransactionItem.objects.filter(
            transaction=sale
        ).count()
        before_total = sale.total_amount

        self.assertEqual(before_items, 1)

        # Below minimum price must be rejected.
        with self.assertRaises(PriceBelowMinimum):
            add_device_to_sale(
                sale_id=sale.id,
                device_id=second_device.id,
                actor=self.owner,
                price_sold=Decimal("4000.00"),
            )

        sale.refresh_from_db()
        first_device.refresh_from_db()
        second_device.refresh_from_db()

        after_items = TransactionItem.objects.filter(
            transaction=sale
        ).count()

        self.assertEqual(after_items, 1)
        self.assertEqual(sale.total_amount, before_total)

        # Adding to a draft sale does not consume inventory.
        self.assertEqual(
            first_device.status,
            DeviceItem.Status.IN_STOCK,
        )
        self.assertEqual(
            second_device.status,
            DeviceItem.Status.IN_STOCK,
        )