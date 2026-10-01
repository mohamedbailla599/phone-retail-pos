from django.test import TestCase

from apps.store_settings.models import StoreSettings
from apps.users.models import User


class SalesTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="sales_test",
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