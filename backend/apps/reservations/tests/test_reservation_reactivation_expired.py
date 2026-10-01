from .base import ReservationTestCase

from decimal import Decimal
from datetime import timedelta


from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import (
    activate_reservation,
    expire_reservation,
    create_reservation,
)
from core.exceptions import ReservationError


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Expired Reactivation Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"REACT-EXPIRED-{self.test_id}",
            name=f"Expired Reactivation Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Expired Reactivation Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"55{self.test_id}12345678",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5000.00"),
            minimum_selling_price=Decimal("4500.00"),
            battery_health=None,
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )


        # ============================================================
        # CREATE RESERVATION
        # ============================================================

        reservation = create_reservation(
            actor=self.owner,
            customer=customer,
            device_id=device.id,
            reserved_price=Decimal("4800.00"),
            notes="Expired reactivation test",
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

        print(
            "EXPIRES AT:",
            reservation.expires_at,
        )


        assert reservation.status == Reservation.Status.ACTIVE

        assert device.status == DeviceItem.Status.RESERVED


        # ============================================================
        # FORCE EXPIRATION
        # ============================================================

        reservation.expires_at = timezone.now() - timedelta(minutes=1)
        reservation.save(update_fields=["expires_at", "updated_at"])

        reservation.refresh_from_db()


        print("\nFORCED EXPIRATION")

        print(
            "EXPIRES AT:",
            reservation.expires_at,
        )

        print(
            "CURRENT TIME:",
            timezone.now(),
        )


        # ============================================================
        # EXPIRE RESERVATION
        # ============================================================

        expire_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
        )

        reservation.refresh_from_db()
        device.refresh_from_db()


        print("\nAFTER EXPIRATION")

        print(
            "RESERVATION STATUS:",
            reservation.status,
        )

        print(
            "DEVICE STATUS:",
            device.status,
        )


        assert reservation.status == Reservation.Status.EXPIRED

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
                "An expired reservation must not be reactivated."
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
        # VERIFY FINAL STATE
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


        assert reservation.status == Reservation.Status.EXPIRED

        assert device.status == DeviceItem.Status.IN_STOCK


        print("\nTEST: PASS")
