from decimal import Decimal

from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.inventory.models import DeviceItem, StockMovement
from apps.sales.services.sales import (
    add_device_to_sale,
    create_sale,
    update_sale_item_price,
)

from .base import SalesTestCase


class UpdateSaleItemPriceTests(SalesTestCase):

    def test_update_device_sale_item_price(self):
        category = Category.objects.create(
            name="Price Update Test",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku="PHONE-PRICE-TEST",
            name="Price Test Phone",
            brand="TestBrand",
            platform="ANDROID",
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1="222222222222222",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5000.00"),
            minimum_selling_price=Decimal("4500.00"),
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

        updated_item = update_sale_item_price(
            sale_id=sale.id,
            item_id=item.id,
            new_price=Decimal("4700.00"),
            actor=self.owner,
        )

        updated_item.refresh_from_db()
        sale.refresh_from_db()
        device.refresh_from_db()

        self.assertEqual(
            updated_item.unit_price,
            Decimal("5000.00"),
        )
        self.assertEqual(
            updated_item.price_sold,
            Decimal("4700.00"),
        )
        self.assertEqual(
            updated_item.line_total,
            Decimal("4700.00"),
        )

        self.assertEqual(
            sale.subtotal,
            Decimal("4700.00"),
        )
        self.assertEqual(
            sale.total_amount,
            Decimal("4700.00"),
        )

        self.assertEqual(
            device.status,
            DeviceItem.Status.IN_STOCK,
        )

        self.assertEqual(
            StockMovement.objects.filter(device=device).count(),
            0,
        )