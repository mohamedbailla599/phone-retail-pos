from decimal import Decimal

from apps.inventory.models import AccessoryStock
from apps.sales.models import TransactionItem
from apps.sales.services.sales import add_accessory_to_sale, create_sale
from core.exceptions import InsufficientAccessoryStock

from .base import InventoryTestCase


class AccessoryCumulativeStockTest(InventoryTestCase):
    def test_cumulative_accessory_quantity_cannot_exceed_stock(self):
        category = self.create_category(
            name="Cumulative Test Accessories",
            is_device=False,
        )

        product = self.create_accessory_product(
            category=category,
            sku="USB-C-CUM-TEST",
            name="USB-C Cumulative Test",
        )

        accessory = AccessoryStock.objects.create(
            product=product,
            cost_price=Decimal("20.00"),
            selling_price=Decimal("50.00"),
            quantity=10,
            reorder_level=2,
        )

        sale = create_sale(actor=self.owner)

        item = add_accessory_to_sale(
            sale_id=sale.id,
            accessory_stock_id=accessory.id,
            quantity=8,
            actor=self.owner,
        )

        with self.assertRaises(InsufficientAccessoryStock):
            add_accessory_to_sale(
                sale_id=sale.id,
                accessory_stock_id=accessory.id,
                quantity=3,
                actor=self.owner,
            )

        sale.refresh_from_db()
        accessory.refresh_from_db()
        item.refresh_from_db()

        self.assertEqual(item.quantity, 8)
        self.assertEqual(accessory.quantity, 10)
        self.assertEqual(sale.total_amount, Decimal("400.00"))