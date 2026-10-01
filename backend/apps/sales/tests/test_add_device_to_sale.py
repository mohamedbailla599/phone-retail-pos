from decimal import Decimal

from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.inventory.models import DeviceItem, StockMovement
from apps.sales.models import Transaction
from apps.sales.services.sales import add_device_to_sale, create_sale

from .base import SalesTestCase


class AddDeviceToSaleTests(SalesTestCase):

    def test_add_device_to_draft_sale(self):
        category = Category.objects.create(
            name="Test Smartphones",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku="IP13-TEST-001",
            name="iPhone 13 Test",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=128,
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

        sale = create_sale(
            actor=self.owner,
            notes="Test add device",
        )

        item = add_device_to_sale(
            sale_id=sale.id,
            device_id=device.id,
            actor=self.owner,
            price_sold=Decimal("4800.00"),
        )

        sale.refresh_from_db()
        device.refresh_from_db()
        item.refresh_from_db()

        # Transaction / item
        self.assertEqual(item.transaction_id, sale.id)
        self.assertEqual(item.device_id, device.id)

        self.assertEqual(item.quantity, 1)
        self.assertEqual(item.unit_price, Decimal("5000.00"))
        self.assertEqual(item.price_sold, Decimal("4800.00"))
        self.assertEqual(item.line_total, Decimal("4800.00"))
        self.assertEqual(item.cost_price_at_sale, Decimal("4000.00"))

        # Snapshots
        self.assertEqual(item.product_name_snapshot, "iPhone 13 Test")
        self.assertEqual(item.sku_snapshot, "IP13-TEST-001")
        self.assertFalse(item.is_complimentary)

        # Sale totals
        self.assertEqual(sale.subtotal, Decimal("4800.00"))
        self.assertEqual(sale.discount_amount, Decimal("0.00"))
        self.assertEqual(sale.total_amount, Decimal("4800.00"))

        # Adding to a draft sale must NOT change inventory status.
        self.assertEqual(
            device.status,
            DeviceItem.Status.IN_STOCK,
        )

        # No inventory movement should happen yet.
        self.assertEqual(
            StockMovement.objects.filter(device=device).count(),
            0,
        )

        self.assertEqual(
            sale.transaction_type,
            Transaction.TransactionType.SALE,
        )
        self.assertEqual(
            sale.status,
            Transaction.Status.DRAFT,
        )