from decimal import Decimal

from apps.catalog.models import Category, Product
from apps.inventory.models import AccessoryStock
from apps.sales.services.sales import (
    add_accessory_to_sale,
    create_sale,
    remove_sale_item,
    set_sale_discount,
)

from .base import SalesTestCase


class RemoveItemClearsDiscountTests(SalesTestCase):

    def test_partial_accessory_removal_clears_discount(self):
        category = Category.objects.create(
            name="Test Accessories Discount Clear",
            is_device=False,
        )

        product = Product.objects.create(
            category=category,
            sku="TEST-DISCOUNT-CLEAR-001",
            name="Discount Clear Accessory",
            brand="TEST",
        )

        stock = AccessoryStock.objects.create(
            product=product,
            cost_price=Decimal("50.00"),
            selling_price=Decimal("100.00"),
            quantity=10,
            reorder_level=2,
        )

        sale = create_sale(
            customer=None,
            notes="Discount clear test",
            actor=self.owner,
        )

        item = add_accessory_to_sale(
            sale_id=sale.id,
            accessory_stock_id=stock.id,
            quantity=3,
            actor=self.owner,
        )

        set_sale_discount(
            sale_id=sale.id,
            discount_amount=Decimal("250.00"),
            actor=self.owner,
        )

        sale.refresh_from_db()

        self.assertEqual(
            sale.subtotal,
            Decimal("300.00"),
        )
        self.assertEqual(
            sale.discount_amount,
            Decimal("250.00"),
        )
        self.assertEqual(
            sale.total_amount,
            Decimal("50.00"),
        )

        remove_sale_item(
            sale_id=sale.id,
            item_id=item.id,
            quantity=1,
            actor=self.owner,
        )

        sale.refresh_from_db()
        item.refresh_from_db()
        stock.refresh_from_db()

        self.assertEqual(
            sale.subtotal,
            Decimal("200.00"),
        )
        self.assertEqual(
            sale.discount_amount,
            Decimal("0.00"),
        )
        self.assertEqual(
            sale.total_amount,
            Decimal("200.00"),
        )

        self.assertEqual(item.quantity, 2)
        self.assertEqual(
            item.line_total,
            Decimal("200.00"),
        )

        # Removing from a draft sale must not modify physical stock.
        self.assertEqual(stock.quantity, 10)