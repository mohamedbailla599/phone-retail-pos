from decimal import Decimal

from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.inventory.models import DeviceItem
from apps.sales.models import Transaction, TransactionItem
from apps.sales.services.sales import add_device_to_sale
from core.exceptions import DeviceNotAvailable

from .base import SalesTestCase


class DeviceUnavailableTests(SalesTestCase):

    def test_unavailable_device_cannot_be_added_to_sale(self):
        category = Category.objects.create(
            name="Unavailable Device Category",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku="UNAVAILABLE-DEVICE-001",
            name="Unavailable Device Test",
            brand="TestBrand",
            platform=Product.Platform.OTHER,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1="350012345678901",
            imei_2=None,
            serial_number="SN-UNAVAILABLE-001",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5000.00"),
            minimum_selling_price=Decimal("4500.00"),
            battery_health=None,
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.SOLD,
            received_at=timezone.now(),
        )

        sale = Transaction.objects.create(
            receipt_id="TEST-UNAVAILABLE-001",
            customer=None,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.DRAFT,
            subtotal=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("0.00"),
            notes="Unavailable device test",
            created_by=self.owner,
        )

        before_items = TransactionItem.objects.filter(
            transaction=sale
        ).count()

        with self.assertRaises(DeviceNotAvailable):
            add_device_to_sale(
                sale_id=sale.id,
                device_id=device.id,
                actor=self.owner,
                price_sold=Decimal("4800.00"),
            )

        sale.refresh_from_db()
        device.refresh_from_db()

        after_items = TransactionItem.objects.filter(
            transaction=sale
        ).count()

        self.assertEqual(after_items, before_items)
        self.assertEqual(
            device.status,
            DeviceItem.Status.SOLD,
        )