from decimal import Decimal

from apps.catalog.models import Category, Product
from apps.inventory.models import AccessoryStock
from apps.sales.models import Transaction
from apps.sales.services.sales import (
    add_accessory_to_sale,
    create_sale,
    move_sale_to_pending_payment,
    set_sale_discount,
)
from core.exceptions import InvalidSale

from .base import SalesTestCase


class MoveSaleToPendingPaymentTests(SalesTestCase):

    def test_draft_sale_moves_to_pending_payment(self):
        category = Category.objects.create(
            name="Test Pending Payment Category",
            is_device=False,
        )

        product = Product.objects.create(
            category=category,
            sku="TEST-PENDING-PAYMENT-001",
            name="Pending Payment Accessory",
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
            actor=self.owner,
            customer=None,
            notes="Pending payment test",
        )

        item = add_accessory_to_sale(
            sale_id=sale.id,
            accessory_stock_id=stock.id,
            quantity=3,
            actor=self.owner,
        )

        set_sale_discount(
            sale_id=sale.id,
            discount_amount=Decimal("50.00"),
            actor=self.owner,
        )

        sale = move_sale_to_pending_payment(
            sale_id=sale.id,
            actor=self.owner,
        )

        sale.refresh_from_db()
        stock.refresh_from_db()
        item.refresh_from_db()

        self.assertEqual(
            sale.status,
            Transaction.Status.PENDING_PAYMENT,
        )
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

        # Moving to PENDING_PAYMENT does not modify inventory.
        self.assertEqual(stock.quantity, 10)

        # Item remains unchanged.
        self.assertEqual(item.quantity, 3)
        self.assertEqual(
            item.line_total,
            Decimal("300.00"),
        )

    def test_sale_cannot_move_to_pending_payment_twice(self):
        sale = create_sale(
            actor=self.owner,
            customer=None,
            notes="Second transition test",
        )

        category = Category.objects.create(
            name="Second Transition Category",
            is_device=False,
        )

        product = Product.objects.create(
            category=category,
            sku="SECOND-TRANSITION-001",
            name="Second Transition Accessory",
            brand="TEST",
        )

        stock = AccessoryStock.objects.create(
            product=product,
            cost_price=Decimal("50.00"),
            selling_price=Decimal("100.00"),
            quantity=10,
            reorder_level=2,
        )

        add_accessory_to_sale(
            sale_id=sale.id,
            accessory_stock_id=stock.id,
            quantity=1,
            actor=self.owner,
        )

        move_sale_to_pending_payment(
            sale_id=sale.id,
            actor=self.owner,
        )

        with self.assertRaises(InvalidSale):
            move_sale_to_pending_payment(
                sale_id=sale.id,
                actor=self.owner,
            )

    def test_empty_sale_cannot_move_to_pending_payment(self):
        sale = create_sale(
            actor=self.owner,
            customer=None,
            notes="Empty sale test",
        )

        with self.assertRaises(InvalidSale):
            move_sale_to_pending_payment(
                sale_id=sale.id,
                actor=self.owner,
            )