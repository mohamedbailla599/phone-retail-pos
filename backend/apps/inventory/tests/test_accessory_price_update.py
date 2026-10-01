from decimal import Decimal

from apps.inventory.models import AccessoryStock
from apps.sales.services.sales import (
    add_accessory_to_sale,
    create_sale,
    update_sale_item_price,
)

from .base import InventoryTestCase


class AccessoryPriceUpdateTest(InventoryTestCase):
    def test_accessory_transaction_price_can_be_updated(self):
        category = self.create_category(
            name="Accessory Price Update Test",
            is_device=False,
        )

        product = self.create_accessory_product(
            category=category,
            sku="ACCESSORY-PRICE-TEST",
            name="Price Test Case",
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

        updated_item = update_sale_item_price(
            sale_id=sale.id,
            item_id=item.id,
            new_price=Decimal("40.00"),
            actor=self.owner,
        )

        updated_item.refresh_from_db()
        sale.refresh_from_db()
        accessory.refresh_from_db()

        self.assertEqual(updated_item.quantity, 3)
        self.assertEqual(updated_item.unit_price, Decimal("50.00"))
        self.assertEqual(updated_item.price_sold, Decimal("40.00"))
        self.assertEqual(updated_item.line_total, Decimal("120.00"))

        self.assertEqual(sale.subtotal, Decimal("120.00"))
        self.assertEqual(sale.total_amount, Decimal("120.00"))

        self.assertEqual(accessory.selling_price, Decimal("50.00"))
        self.assertEqual(accessory.quantity, 10)