from .base import ReservationTestCase

from decimal import Decimal


from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import (
    activate_reservation,
    cancel_reservation,
    create_reservation,
)
from core.exceptions import ReservationError


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Reactivation Cancelled Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"REACT-CANCEL-{self.test_id}",
            name=f"Reactivation Cancelled Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Reactivation Cancelled Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"44{self.test_id}12345678",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5000.00"),
            minimum_selling_price=Decimal("4500.00"),
            battery_health=None,
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )


        # ============================================================
        # CREATE + ACTIVATE
        # ============================================================

        reservation = create_reservation(
            actor=self.owner,
            customer=customer,
            device_id=device.id,
            reserved_price=Decimal("4800.00"),
            notes="Cancelled reactivation test",
        )

        activate_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
        )

        reservation.refresh_from_db()
        device.refresh_from_db()


        print("AFTER ACTIVATION")

        print(
            "RESERVATION STATUS:",
            reservation.status,
        )

        print(
            "DEVICE STATUS:",
            device.status,
        )

        assert reservation.status == Reservation.Status.ACTIVE

        assert device.status == DeviceItem.Status.RESERVED


        # ============================================================
        # CANCEL
        # ============================================================

        cancel_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
            reason="Customer cancelled",
        )

        reservation.refresh_from_db()
        device.refresh_from_db()


        print("\nAFTER CANCELLATION")

        print(
            "RESERVATION STATUS:",
            reservation.status,
        )

        print(
            "DEVICE STATUS:",
            device.status,
        )


        assert reservation.status == Reservation.Status.CANCELLED

        assert device.status == DeviceItem.Status.IN_STOCK


        # ============================================================
        # REACTIVATION MUST FAIL
        # ============================================================

        try:

            activate_reservation(
                reservation_id=reservation.id,
                actor=self.owner,
            )

            raise AssertionError(
                "A cancelled reservation must not be "
                "reactivated."
            )

        except ReservationError as exc:

            print("\nREACTIVATION REJECTED")

            print(
                "EXCEPTION:",
                type(exc).__name__,
            )

            print(
                "CODE:",
                getattr(exc, "code", None),
            )


        # ============================================================
        # VERIFY NOTHING CHANGED
        # ============================================================

        reservation.refresh_from_db()
        device.refresh_from_db()


        print("\nFINAL STATE")

        print(
            "RESERVATION STATUS:",
            reservation.status,
        )

        print(
            "DEVICE STATUS:",
            device.status,
        )


        assert reservation.status == Reservation.Status.CANCELLED

        assert device.status == DeviceItem.Status.IN_STOCK

        print("\nTEST: PASS")
