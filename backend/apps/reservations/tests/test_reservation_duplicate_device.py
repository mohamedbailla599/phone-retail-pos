from .base import ReservationTestCase

from decimal import Decimal


from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import (
    activate_reservation,
    create_reservation,
)
from core.exceptions import DeviceNotAvailable


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Duplicate Device Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"DUP-DEVICE-{self.test_id}",
            name=f"Duplicate Device Test Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer_1 = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Duplicate Customer One {self.test_id}",
        )

        customer_2 = Customer.objects.create(
            phone_number=f"07{self.test_id[:8]}",
            full_name=f"Duplicate Customer Two {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"43{self.test_id}12345678",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5000.00"),
            minimum_selling_price=Decimal("4500.00"),
            battery_health=None,
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )


        # ============================================================
        # FIRST RESERVATION
        # ============================================================

        reservation_1 = create_reservation(
            actor=self.owner,
            customer=customer_1,
            device_id=device.id,
            reserved_price=Decimal("4800.00"),
            notes="First reservation",
        )

        activate_reservation(
            reservation_id=reservation_1.id,
            actor=self.owner,
        )

        reservation_1.refresh_from_db()
        device.refresh_from_db()


        print("FIRST RESERVATION")

        print(
            "RESERVATION STATUS:",
            reservation_1.status,
        )

        print(
            "DEVICE STATUS:",
            device.status,
        )


        assert reservation_1.status == Reservation.Status.ACTIVE

        assert device.status == DeviceItem.Status.RESERVED


        # ============================================================
        # SECOND RESERVATION MUST FAIL AT CREATION
        # ============================================================

        try:

            create_reservation(
                actor=self.owner,
                customer=customer_2,
                device_id=device.id,
                reserved_price=Decimal("4700.00"),
                notes="Second reservation attempt",
            )

            raise AssertionError(
                "A second reservation should not be created "
                "for a device that is already reserved."
            )

        except DeviceNotAvailable as exc:

            print("\nSECOND RESERVATION REJECTED")

            print(
                "EXCEPTION:",
                type(exc).__name__,
            )

            print(
                "CODE:",
                getattr(exc, "code", None),
            )


        # ============================================================
        # VERIFY FIRST RESERVATION IS UNCHANGED
        # ============================================================

        reservation_1.refresh_from_db()
        device.refresh_from_db()


        print("\nFINAL STATE")

        print(
            "FIRST RESERVATION:",
            reservation_1.status,
        )

        print(
            "DEVICE STATUS:",
            device.status,
        )


        # ============================================================
        # ASSERTIONS
        # ============================================================

        assert reservation_1.status == Reservation.Status.ACTIVE

        assert device.status == DeviceItem.Status.RESERVED


        print("\nTEST: PASS")
