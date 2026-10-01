from decimal import Decimal

from apps.inventory.models import AccessoryStock
from apps.sales.services.sales import add_accessory_to_sale, create_sale

from .base import InventoryTestCase


class AccessoryNegotiatedPriceTest(InventoryTestCase):
    def test_accessory_can_have_negotiated_transaction_price(self):
        category = self.create_category(
            name="Negotiated Price Test",
            is_device=False,
        )

        product = self.create_accessory_product(
            category=category,
            sku="CHARGER-NEG-TEST",
            name="Fast Charger Test",
        )

        accessory = AccessoryStock.objects.create(
            product=product,
            cost_price=Decimal("30.00"),
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
            price_sold=Decimal("45.00"),
        )

        sale.refresh_from_db()
        accessory.refresh_from_db()
        item.refresh_from_db()

        self.assertEqual(item.quantity, 2)
        self.assertEqual(item.unit_price, Decimal("50.00"))
        self.assertEqual(item.price_sold, Decimal("45.00"))
        self.assertEqual(item.line_total, Decimal("90.00"))
        self.assertEqual(sale.subtotal, Decimal("90.00"))
        self.assertEqual(sale.total_amount, Decimal("90.00"))
        self.assertEqual(accessory.quantity, 10)