from decimal import Decimal

from apps.catalog.models import Category, Product
from apps.inventory.models import AccessoryStock
from apps.sales.services.sales import (
    add_accessory_to_sale,
    create_sale,
    set_sale_discount,
)

from .base import SalesTestCase


class RemoveSaleDiscountTests(SalesTestCase):

    def test_remove_sale_discount(self):
        category = Category.objects.create(
            name="Discount Remove Test",
            is_device=False,
        )

        product = Product.objects.create(
            category=category,
            sku="DISCOUNT-REMOVE-TEST",
            name="Discount Remove Accessory",
            brand="TestBrand",
            platform="OTHER",
            is_active=True,
        )

        stock = AccessoryStock.objects.create(
            product=product,
            cost_price=Decimal("20.00"),
            selling_price=Decimal("100.00"),
            quantity=10,
            reorder_level=2,
        )

        sale = create_sale(actor=self.owner)

        item = add_accessory_to_sale(
            sale_id=sale.id,
            accessory_stock_id=stock.id,
            quantity=3,
            actor=self.owner,
        )

        # Apply discount.
        set_sale_discount(
            sale_id=sale.id,
            discount_amount=Decimal("50.00"),
            actor=self.owner,
        )

        sale.refresh_from_db()

        self.assertEqual(
            sale.subtotal,
            Decimal("300.00"),
        )
        self.assertEqual(
            sale.discount_amount,
            Decimal("50.00"),
        )
        self.assertEqual(
            sale.total_amount,
            Decimal("250.00"),
        )

        # Remove discount.
        set_sale_discount(
            sale_id=sale.id,
            discount_amount=Decimal("0.00"),
            actor=self.owner,
        )

        sale.refresh_from_db()
        item.refresh_from_db()
        stock.refresh_from_db()

        self.assertEqual(
            sale.subtotal,
            Decimal("300.00"),
        )
        self.assertEqual(
            sale.discount_amount,
            Decimal("0.00"),
        )
        self.assertEqual(
            sale.total_amount,
            Decimal("300.00"),
        )

        # Removing a sale discount must not modify item pricing.
        self.assertEqual(
            item.price_sold,
            Decimal("100.00"),
        )
        self.assertEqual(
            item.line_total,
            Decimal("300.00"),
        )

        # Draft sale operations must not modify physical stock.
        self.assertEqual(stock.quantity, 10)