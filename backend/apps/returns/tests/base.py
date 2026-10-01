from decimal import Decimal
from uuid import uuid4

from django.test import TestCase
from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.payments.models import Payment
from apps.payments.services.payments import create_payment
from apps.sales.models import Transaction
from apps.sales.services.sales import (
    add_device_to_sale,
    complete_sale,
    create_sale,
    move_sale_to_pending_payment,
)
from apps.store_settings.models import StoreSettings
from apps.users.models import User


class ReturnTestCase(TestCase):
    def setUp(self):
        self.test_id = uuid4().hex[:8]

        self.user = User.objects.create_user(
            username=f"return_test_{self.test_id}",
            password="test123",
            is_active=True,
            role=User.Role.OWNER,
        )

        self.store_settings = StoreSettings.objects.create(
            store_name="Bighrissen Phone",
            currency="MAD",
            default_device_warranty_months=1,
            default_reservation_months=1,
            default_accessory_warranty_months=0,
            receipt_prefix="BP",
            updated_by=self.user,
        )

        self.customer = self.create_customer()

    def create_customer(self, name="Return Test Customer"):
        return Customer.objects.create(
            phone_number=f"06{uuid4().hex[:8]}",
            full_name=name,
        )

    def create_device(self, suffix=None):
        suffix = suffix or uuid4().hex[:4]

        category = Category.objects.create(
            name=f"Return Phones {self.test_id}-{suffix}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"RET-{self.test_id}-{suffix}",
            name=f"Return Test Phone {suffix}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
        )

        return DeviceItem.objects.create(
            product=product,
            imei_1=f"35{self.test_id}{suffix}001",
            cost_price=Decimal("3000.00"),
            default_selling_price=Decimal("4500.00"),
            minimum_selling_price=Decimal("4000.00"),
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )

    def create_completed_sale(self, device=None, customer=None):
        device = device or self.create_device()
        customer = customer or self.customer

        sale = create_sale(
            actor=self.user,
            customer=customer,
        )

        add_device_to_sale(
            sale_id=sale.id,
            device_id=device.id,
            actor=self.user,
        )

        item = sale.items.first()

        move_sale_to_pending_payment(
            sale_id=sale.id,
            actor=self.user,
        )

        sale.refresh_from_db()

        create_payment(
            sale_id=sale.id,
            amount=sale.total_amount,
            method=Payment.Method.CASH,
            actor=self.user,
        )

        complete_sale(
            sale_id=sale.id,
            actor=self.user,
        )

        sale.refresh_from_db()
        device.refresh_from_db()

        self.assertEqual(sale.status, Transaction.Status.COMPLETED)
        self.assertEqual(device.status, DeviceItem.Status.SOLD)

        return sale, item, device
