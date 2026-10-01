from decimal import Decimal

from apps.inventory.models import AccessoryStock
from apps.sales.services.sales import (
    add_accessory_to_sale,
    create_sale,
    update_sale_item_price,
)
from core.exceptions import InvalidSaleItem

from .base import InventoryTestCase


class AccessoryPriceZeroTest(InventoryTestCase):
    def test_zero_price_is_rejected_for_normal_accessory_item(self):
        category = self.create_category(
            name="Accessory Zero Price Test",
            is_device=False,
        )

        product = self.create_accessory_product(
            category=category,
            sku="ACCESSORY-ZERO-PRICE-TEST",
            name="Zero Price Test Case",
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
            quantity=2,
            actor=self.owner,
        )

        with self.assertRaises(InvalidSaleItem):
            update_sale_item_price(
                sale_id=sale.id,
                item_id=item.id,
                new_price=Decimal("0.00"),
                actor=self.owner,
            )

        item.refresh_from_db()
        sale.refresh_from_db()
        accessory.refresh_from_db()

        self.assertEqual(item.quantity, 2)
        self.assertEqual(item.unit_price, Decimal("50.00"))
        self.assertEqual(item.price_sold, Decimal("50.00"))
        self.assertEqual(item.line_total, Decimal("100.00"))
        self.assertFalse(item.is_complimentary)

        self.assertEqual(sale.subtotal, Decimal("100.00"))
        self.assertEqual(sale.total_amount, Decimal("100.00"))
        self.assertEqual(accessory.quantity, 10)