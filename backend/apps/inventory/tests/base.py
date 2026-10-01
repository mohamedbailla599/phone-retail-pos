from django.test import TestCase

from apps.catalog.models import Category, Product
from apps.store_settings.models import StoreSettings
from apps.users.models import User


class InventoryTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="inventory_test",
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

    def create_category(self, name="Test Accessories", is_device=False):
        return Category.objects.create(
            name=name,
            is_device=is_device,
        )

    def create_accessory_product(
        self,
        *,
        category,
        sku="TEST-ACC",
        name="Test Accessory",
    ):
        return Product.objects.create(
            category=category,
            sku=sku,
            name=name,
            brand="TestBrand",
            platform="OTHER",
            is_active=True,
        )