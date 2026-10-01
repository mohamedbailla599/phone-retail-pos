from decimal import Decimal

from django.test import TestCase

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.sales.models import Transaction, TransactionItem
from apps.store_settings.models import StoreSettings
from apps.users.models import User


class ExchangeTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="exchange_test_owner",
            password="testpass123",
            role=User.Role.OWNER,
        )
        cls.customer = Customer.objects.create(
            phone_number="0600000000",
            full_name="Exchange Test Customer",
        )
        cls.category = Category.objects.create(
            name="Exchange Test Smartphones",
            is_device=True,
        )
        cls.old_product = Product.objects.create(
            category=cls.category,
            sku="EX-OLD-IPHONE",
            name="Old iPhone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=128,
            is_active=True,
        )
        cls.new_product = Product.objects.create(
            category=cls.category,
            sku="EX-NEW-IPHONE",
            name="New iPhone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=256,
            is_active=True,
        )
        cls.store_settings = StoreSettings.objects.create(
            store_name="Bighrissen Phone",
            currency="MAD",
            default_device_warranty_months=1,
            default_reservation_months=1,
            default_accessory_warranty_months=0,
            receipt_prefix="BP",
            updated_by=cls.owner,
        )

    def create_device(
        self,
        *,
        product,
        imei,
        status,
        cost="3000.00",
        selling="4000.00",
        minimum="3500.00",
    ):
        return DeviceItem.objects.create(
            product=product,
            imei_1=imei,
            cost_price=Decimal(cost),
            default_selling_price=Decimal(selling),
            minimum_selling_price=Decimal(minimum),
            status=status,
            received_at="2026-09-30T10:00:00Z",
        )

    def create_completed_sale(self, old_device, price="4000.00"):
        sale = Transaction.objects.create(
            receipt_id=f"BP-EX-TEST-{old_device.id}",
            customer=self.customer,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.COMPLETED,
            subtotal=Decimal(price),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal(price),
            created_by=self.owner,
        )
        TransactionItem.objects.create(
            transaction=sale,
            device=old_device,
            product_name_snapshot=old_device.product.name,
            sku_snapshot=old_device.product.sku,
            quantity=1,
            unit_price=Decimal(price),
            price_sold=Decimal(price),
            line_total=Decimal(price),
            cost_price_at_sale=old_device.cost_price,
        )
        return sale

    def approve_exchange(
        self,
        *,
        old_device,
        new_device,
        old_value,
        new_price,
        reason=None,
    ):
        from apps.exchanges.services.exchanges import (
            approve_exchange,
            create_exchange,
            submit_exchange_for_review,
        )

        sale = self.create_completed_sale(old_device)
        exchange = create_exchange(
            customer=self.customer,
            original_transaction=sale,
            old_device=old_device,
            new_device=new_device,
            old_device_value=Decimal(old_value),
            new_device_price=Decimal(new_price),
            reason=reason,
            actor=self.owner,
        )
        submit_exchange_for_review(
            exchange_id=exchange.id,
            actor=self.owner,
        )
        approve_exchange(
            exchange_id=exchange.id,
            actor=self.owner,
        )
        exchange.refresh_from_db()
        return exchange
