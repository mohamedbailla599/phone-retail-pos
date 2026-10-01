from .base import ReservationTestCase

from decimal import Decimal


from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import (
    activate_reservation,
    complete_reservation,
    create_reservation,
)
from apps.sales.models import Transaction
from core.exceptions import ReservationBalanceRemaining


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Completion Test Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"COMP-TEST-{self.test_id}",
            name=f"Completion Test Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Completion Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"39{self.test_id}12345678",
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
            notes="Reservation completion test",
        )


        # ============================================================
        # ACTIVATE
        # ============================================================

        activate_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
        )


        reservation.refresh_from_db()
        device.refresh_from_db()

        transaction = reservation.transaction


        print("BEFORE COMPLETION")
        print("RESERVATION STATUS:", reservation.status)
        print("TRANSACTION STATUS:", transaction.status)
        print("DEVICE STATUS:", device.status)
        print("RESERVED PRICE:", reservation.reserved_price)


        # ============================================================
        # COMPLETION WITHOUT PAYMENT MUST FAIL
        # ============================================================

        try:

            complete_reservation(
                reservation_id=reservation.id,
                actor=self.owner,
            )

            raise AssertionError(
                "complete_reservation() should reject a reservation "
                "with remaining balance."
            )

        except ReservationBalanceRemaining as exc:

            print("\nCOMPLETION WITHOUT PAYMENT REJECTED")
            print("EXCEPTION:", type(exc).__name__)
            print("CODE:", getattr(exc, "code", None))


        # ============================================================
        # VERIFY NOTHING CHANGED
        # ============================================================

        reservation.refresh_from_db()
        transaction.refresh_from_db()
        device.refresh_from_db()


        assert reservation.status == Reservation.Status.ACTIVE

        assert (
            transaction.status
            == Transaction.Status.PENDING_PAYMENT
        )

        assert device.status == DeviceItem.Status.RESERVED


        print("\nTEST: PASS")
