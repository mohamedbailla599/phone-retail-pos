from decimal import Decimal

from apps.catalog.models import Category, Product
from apps.inventory.models import AccessoryStock
from apps.sales.services.sales import (
    add_accessory_to_sale,
    create_sale,
    move_sale_to_pending_payment,
)
from apps.store_settings.models import StoreSettings
from apps.users.models import User

from django.test import TestCase


class PaymentTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="payment_test",
            password="test123",
            role=User.Role.OWNER,
        )

        self.store_settings = StoreSettings.objects.create(
            store_name="Bighrissen Phone",
            currency="MAD",
            default_device_warranty_months=1,
            default_reservation_months=1,
            default_accessory_warranty_months=0,
            receipt_prefix="BP",
            updated_by=self.owner,
        )

    def create_sale_with_accessories(self, quantity=10):
        category = Category.objects.create(
            name=f"Payment Test Category {self._testMethodName}",
            is_device=False,
        )

        product = Product.objects.create(
            category=category,
            sku=f"PAY-{self._testMethodName}-{quantity}",
            name="Payment Test Accessory",
            brand="TEST",
            platform="OTHER",
            is_active=True,
        )

        stock = AccessoryStock.objects.create(
            product=product,
            cost_price=Decimal("50.00"),
            selling_price=Decimal("100.00"),
            quantity=quantity,
            reorder_level=2,
        )

        sale = create_sale(
            actor=self.owner,
            notes="Payment test",
        )

        add_accessory_to_sale(
            sale_id=sale.id,
            accessory_stock_id=stock.id,
            quantity=quantity,
            actor=self.owner,
        )

        move_sale_to_pending_payment(
            sale_id=sale.id,
            actor=self.owner,
        )

        sale.refresh_from_db()
        stock.refresh_from_db()

        return sale, stock