from decimal import Decimal

from apps.inventory.models import AccessoryStock
from apps.sales.models import TransactionItem
from apps.sales.services.sales import (
    add_accessory_to_sale,
    create_sale,
    remove_sale_item,
)

from .base import InventoryTestCase


class RemoveAccessoryCompleteTest(InventoryTestCase):
    def test_remove_entire_accessory_line(self):
        category = self.create_category(
            name="Remove Accessory Complete Test",
            is_device=False,
        )

        product = self.create_accessory_product(
            category=category,
            sku="ACCESSORY-REMOVE-COMPLETE",
            name="Accessory Complete Removal Test",
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

        remove_sale_item(
            sale_id=sale.id,
            item_id=item.id,
            actor=self.owner,
            quantity=3,
        )

        sale.refresh_from_db()
        accessory.refresh_from_db()

        self.assertFalse(
            TransactionItem.objects.filter(id=item.id).exists()
        )
        self.assertEqual(accessory.quantity, 10)
        self.assertEqual(sale.subtotal, Decimal("0.00"))
        self.assertEqual(sale.total_amount, Decimal("0.00"))