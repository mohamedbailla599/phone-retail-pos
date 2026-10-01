from decimal import Decimal

from apps.inventory.models import AccessoryStock
from apps.sales.services.sales import add_accessory_to_sale, create_sale

from .base import InventoryTestCase


class AccessorySaleTest(InventoryTestCase):
    def test_accessory_can_be_added_to_draft_sale(self):
        category = self.create_category(
            name="Accessory Sale Test",
            is_device=False,
        )

        product = self.create_accessory_product(
            category=category,
            sku="USB-C-TEST",
            name="USB-C Cable Test",
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
            quantity=3,
            actor=self.owner,
        )

        sale.refresh_from_db()
        accessory.refresh_from_db()
        item.refresh_from_db()

        self.assertEqual(accessory.quantity, 10)
        self.assertEqual(item.quantity, 3)
        self.assertEqual(item.line_total, Decimal("150.00"))
        self.assertEqual(sale.subtotal, Decimal("150.00"))
        self.assertEqual(sale.total_amount, Decimal("150.00"))