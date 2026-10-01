from decimal import Decimal

from apps.inventory.models import AccessoryStock
from apps.sales.models import TransactionItem
from apps.sales.services.sales import (
    add_accessory_to_sale,
    create_sale,
    remove_sale_item,
)

from .base import InventoryTestCase


class RemoveAccessoryPartialTest(InventoryTestCase):
    def test_partial_accessory_removal(self):
        category = self.create_category(
            name="Remove Accessory Test",
            is_device=False,
        )

        product = self.create_accessory_product(
            category=category,
            sku="ACCESSORY-REMOVE-TEST",
            name="Accessory Remove Test",
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
            quantity=5,
            actor=self.owner,
        )

        remove_sale_item(
            sale_id=sale.id,
            item_id=item.id,
            actor=self.owner,
            quantity=2,
        )

        sale.refresh_from_db()
        accessory.refresh_from_db()
        item.refresh_from_db()

        self.assertTrue(
            TransactionItem.objects.filter(id=item.id).exists()
        )
        self.assertEqual(item.quantity, 3)
        self.assertEqual(item.line_total, Decimal("150.00"))
        self.assertEqual(accessory.quantity, 10)
        self.assertEqual(sale.subtotal, Decimal("150.00"))
        self.assertEqual(sale.total_amount, Decimal("150.00"))