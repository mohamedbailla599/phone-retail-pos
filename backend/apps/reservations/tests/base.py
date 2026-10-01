from decimal import Decimal
from uuid import uuid4

from django.test import TransactionTestCase
from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.store_settings.models import StoreSettings
from apps.users.models import User


class ReservationTestCase(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="reservation_test",
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
        self.test_id = uuid4().hex[:8]

    def create_category(self, name="Reservation Test Category"):
        return Category.objects.create(
            name=f"{name} {self.test_id}",
            is_device=True,
        )

    def create_product(self, *, category, sku="RES-TEST", name="Reservation Test Phone"):
        return Product.objects.create(
            category=category,
            sku=f"{sku}-{self.test_id}",
            name=f"{name} {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

    def create_customer(self, *, prefix="06", name="Reservation Customer"):
        return Customer.objects.create(
            phone_number=f"{prefix}{self.test_id[:8]}",
            full_name=f"{name} {self.test_id}",
        )

    def create_device(
        self,
        *,
        category=None,
        sku="RES-TEST",
        name="Reservation Test Phone",
        imei_prefix="35",
        cost="4000.00",
        selling="5000.00",
        minimum="4500.00",
    ):
        category = category or self.create_category()
        product = self.create_product(category=category, sku=sku, name=name)
        return DeviceItem.objects.create(
            product=product,
            imei_1=f"{imei_prefix}{self.test_id}12345678",
            cost_price=Decimal(cost),
            default_selling_price=Decimal(selling),
            minimum_selling_price=Decimal(minimum),
            battery_health=None,
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )
