from decimal import Decimal

from apps.inventory.models import AccessoryStock
from apps.sales.models import TransactionItem
from apps.sales.services.sales import add_accessory_to_sale, create_sale

from .base import InventoryTestCase


class AccessoryComplimentaryTest(InventoryTestCase):
    def test_complimentary_accessory_keeps_stock_until_sale_completion(self):
        category = self.create_category(
            name="Complimentary Test",
            is_device=False,
        )

        product = self.create_accessory_product(
            category=category,
            sku="CASE-COMP-TEST",
            name="Phone Case Complimentary Test",
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
            is_complimentary=True,
        )

        sale.refresh_from_db()
        accessory.refresh_from_db()
        item.refresh_from_db()

        self.assertEqual(item.quantity, 2)
        self.assertEqual(item.unit_price, Decimal("50.00"))
        self.assertEqual(item.price_sold, Decimal("0.00"))
        self.assertEqual(item.line_total, Decimal("0.00"))
        self.assertTrue(item.is_complimentary)

        self.assertEqual(sale.subtotal, Decimal("0.00"))
        self.assertEqual(sale.total_amount, Decimal("0.00"))

        # Inventory is consumed only when the sale is completed.
        self.assertEqual(accessory.quantity, 10)