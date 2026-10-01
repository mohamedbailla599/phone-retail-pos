from decimal import Decimal

from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.inventory.models import DeviceItem
from apps.sales.models import Transaction, TransactionItem
from apps.sales.services.sales import add_device_to_sale
from core.exceptions import InvalidSale

from .base import SalesTestCase


class NonDraftSaleTests(SalesTestCase):

    def test_device_cannot_be_added_to_non_draft_sale(self):
        category = Category.objects.create(
            name="Non Draft Sale Category",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku="NON-DRAFT-001",
            name="Non Draft Test Phone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=128,
            is_active=True,
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1="350000000000001",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5000.00"),
            minimum_selling_price=Decimal("4500.00"),
            battery_health=95,
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )

        sale = Transaction.objects.create(
            receipt_id="TEST-NON-DRAFT-001",
            customer=None,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.PENDING_PAYMENT,
            subtotal=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("0.00"),
            notes="Non-draft sale test",
            created_by=self.owner,
        )

        before_items = TransactionItem.objects.filter(
            transaction=sale
        ).count()

        self.assertEqual(
            sale.status,
            Transaction.Status.PENDING_PAYMENT,
        )

        with self.assertRaises(InvalidSale):
            add_device_to_sale(
                sale_id=sale.id,
                device_id=device.id,
                actor=self.owner,
                price_sold=Decimal("4800.00"),
            )

        after_items = TransactionItem.objects.filter(
            transaction=sale
        ).count()

        device.refresh_from_db()

        self.assertEqual(after_items, before_items)
        self.assertEqual(
            device.status,
            DeviceItem.Status.IN_STOCK,
        )