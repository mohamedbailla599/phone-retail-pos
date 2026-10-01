from decimal import Decimal

from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.inventory.models import DeviceItem
from apps.sales.models import TransactionItem
from apps.sales.services.sales import (
    add_device_to_sale,
    create_sale,
    remove_sale_item,
)

from .base import SalesTestCase


class RemoveDeviceSaleItemTests(SalesTestCase):

    def test_remove_device_from_sale(self):
        category = Category.objects.create(
            name="Remove Device Test",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku="PHONE-REMOVE-TEST",
            name="Phone Remove Test",
            brand="TestBrand",
            platform="ANDROID",
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1="111111111111111",
            cost_price=Decimal("3000.00"),
            default_selling_price=Decimal("4000.00"),
            minimum_selling_price=Decimal("3500.00"),
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )

        sale = create_sale(actor=self.owner)

        item = add_device_to_sale(
            sale_id=sale.id,
            device_id=device.id,
            actor=self.owner,
        )

        sale.refresh_from_db()
        device.refresh_from_db()

        self.assertTrue(
            TransactionItem.objects.filter(id=item.id).exists()
        )

        self.assertEqual(
            sale.subtotal,
            Decimal("4000.00"),
        )
        self.assertEqual(
            sale.total_amount,
            Decimal("4000.00"),
        )
        self.assertEqual(
            device.status,
            DeviceItem.Status.IN_STOCK,
        )

        remove_sale_item(
            sale_id=sale.id,
            item_id=item.id,
            actor=self.owner,
        )

        sale.refresh_from_db()
        device.refresh_from_db()

        item_exists = TransactionItem.objects.filter(
            id=item.id
        ).exists()

        self.assertFalse(item_exists)
        self.assertEqual(
            sale.subtotal,
            Decimal("0.00"),
        )
        self.assertEqual(
            sale.total_amount,
            Decimal("0.00"),
        )
        self.assertEqual(
            device.status,
            DeviceItem.Status.IN_STOCK,
        )