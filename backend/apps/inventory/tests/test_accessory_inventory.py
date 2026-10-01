from apps.inventory.models import AccessoryStock, StockMovement
from apps.inventory.services.inventory import (
    adjust_accessory_stock,
    complimentary_accessory_stock,
    receive_accessory_stock,
    sell_accessory_stock,
)
from core.exceptions import InsufficientAccessoryStock

from .base import InventoryTestCase


class AccessoryInventoryTest(InventoryTestCase):
    def test_accessory_inventory_lifecycle(self):
        category = self.create_category(
            name="Inventory Test Accessories",
            is_device=False,
        )

        product = self.create_accessory_product(
            category=category,
            sku="TEST-ACC-INVENTORY",
            name="Test Phone Case",
        )

        stock = AccessoryStock.objects.create(
            product=product,
            cost_price="20.00",
            selling_price="50.00",
            quantity=0,
            reorder_level=5,
        )

        receive_accessory_stock(
            accessory_stock_id=stock.id,
            quantity=10,
            actor=self.owner,
            reason="Initial test reception",
        )

        stock.refresh_from_db()
        self.assertEqual(stock.quantity, 10)

        sell_accessory_stock(
            accessory_stock_id=stock.id,
            quantity=3,
            actor=self.owner,
            reference_type="Transaction",
            reference_id=1,
            reason="Test sale",
        )

        stock.refresh_from_db()
        self.assertEqual(stock.quantity, 7)

        complimentary_accessory_stock(
            accessory_stock_id=stock.id,
            quantity=2,
            actor=self.owner,
            reference_type="Transaction",
            reference_id=1,
            reason="Complimentary phone case",
        )

        stock.refresh_from_db()
        self.assertEqual(stock.quantity, 5)

        adjust_accessory_stock(
            accessory_stock_id=stock.id,
            quantity_delta=5,
            actor=self.owner,
            reason="Physical inventory correction",
        )

        stock.refresh_from_db()
        self.assertEqual(stock.quantity, 10)

        with self.assertRaises(InsufficientAccessoryStock):
            sell_accessory_stock(
                accessory_stock_id=stock.id,
                quantity=100,
                actor=self.owner,
                reason="Intentional over-sale test",
            )

        stock.refresh_from_db()
        self.assertEqual(stock.quantity, 10)

        movements = StockMovement.objects.filter(
            accessory_stock=stock
        ).order_by("created_at")

        self.assertEqual(movements.count(), 4)