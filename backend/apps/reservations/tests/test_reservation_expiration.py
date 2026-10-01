from .base import ReservationTestCase

from decimal import Decimal


from django.utils import timezone

from apps.audit.models import AuditLog
from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem, StockMovement
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import (
    activate_reservation,
    create_reservation,
    expire_reservation,
)
from apps.sales.models import Transaction
from core.exceptions import ReservationError


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Expiration Test Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"EXP-TEST-{self.test_id}",
            name=f"Expiration Test Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Expiration Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"38{self.test_id}12345678",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5000.00"),
            minimum_selling_price=Decimal("4500.00"),
            battery_health=None,
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )


        # ============================================================
        # CREATE + ACTIVATE RESERVATION
        # ============================================================

        reservation = create_reservation(
            actor=self.owner,
            customer=customer,
            device_id=device.id,
            reserved_price=Decimal("4800.00"),
            notes="Reservation expiration test",
        )

        activate_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
        )

        reservation.refresh_from_db()
        device.refresh_from_db()

        transaction = reservation.transaction


        print("BEFORE EXPIRATION")
        print("RESERVATION STATUS:", reservation.status)
        print("TRANSACTION STATUS:", transaction.status)
        print("DEVICE STATUS:", device.status)
        print("EXPIRES AT:", reservation.expires_at)


        # ============================================================
        # TEST 1 — PREMATURE EXPIRATION MUST FAIL
        # ============================================================

        try:
            expire_reservation(
                reservation_id=reservation.id,
                actor=self.owner,
            )

            raise AssertionError(
                "expire_reservation() should reject a reservation "
                "that has not expired yet."
            )

        except ReservationError as exc:
            print("\nPREMATURE EXPIRATION REJECTED")
            print("EXCEPTION:", type(exc).__name__)
            print("CODE:", getattr(exc, "code", None))


        # Reservation must still be active.

        reservation.refresh_from_db()
        transaction.refresh_from_db()
        device.refresh_from_db()

        assert reservation.status == Reservation.Status.ACTIVE

        assert transaction.status == Transaction.Status.PENDING_PAYMENT

        assert device.status == DeviceItem.Status.RESERVED


        # ============================================================
        # FORCE EXPIRATION
        # ============================================================

        Reservation.objects.filter(
            id=reservation.id,
        ).update(
            expires_at=timezone.now(),
        )

        reservation.refresh_from_db()


        # ============================================================
        # COUNT MOVEMENTS BEFORE EXPIRATION
        # ============================================================

        movement_count_before = StockMovement.objects.filter(
            device=device,
        ).count()


        # ============================================================
        # EXPIRE RESERVATION
        # ============================================================

        expire_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
        )


        # ============================================================
        # REFRESH
        # ============================================================

        reservation.refresh_from_db()
        transaction.refresh_from_db()
        device.refresh_from_db()


        # ============================================================
        # FIND RELEASE MOVEMENT
        # ============================================================

        movement = StockMovement.objects.filter(
            device=device,
            reference_type="Reservation",
            reference_id=reservation.id,
            movement_type=StockMovement.MovementType.RESERVATION_RELEASED,
        ).order_by("-id").first()


        # ============================================================
        # FIND AUDIT LOG
        # ============================================================

        audit = AuditLog.objects.filter(
            entity_type="Reservation",
            entity_id=reservation.id,
            action="RESERVATION_EXPIRED",
        ).order_by("-id").first()


        # ============================================================
        # OUTPUT
        # ============================================================

        print("\nAFTER EXPIRATION")

        print(
            "RESERVATION STATUS:",
            reservation.status,
        )

        print(
            "TRANSACTION STATUS:",
            transaction.status,
        )

        print(
            "DEVICE STATUS:",
            device.status,
        )

        print(
            "MOVEMENT ID:",
            movement.id if movement else None,
        )

        print(
            "MOVEMENT TYPE:",
            movement.movement_type if movement else None,
        )

        print(
            "FROM STATUS:",
            movement.from_status if movement else None,
        )

        print(
            "TO STATUS:",
            movement.to_status if movement else None,
        )

        print(
            "AUDIT LOG ID:",
            audit.id if audit else None,
        )

        movement_count_after = StockMovement.objects.filter(
            device=device,
        ).count()

        print(
            "MOVEMENTS BEFORE:",
            movement_count_before,
        )

        print(
            "MOVEMENTS AFTER:",
            movement_count_after,
        )


        # ============================================================
        # ASSERTIONS
        # ============================================================

        assert reservation.status == Reservation.Status.EXPIRED

        assert (
            transaction.transaction_type
            == Transaction.TransactionType.RESERVATION
        )

        assert transaction.status == Transaction.Status.CANCELLED

        assert device.status == DeviceItem.Status.IN_STOCK

        assert movement is not None

        assert (
            movement.movement_type
            == StockMovement.MovementType.RESERVATION_RELEASED
        )

        assert movement.from_status == DeviceItem.Status.RESERVED

        assert movement.to_status == DeviceItem.Status.IN_STOCK

        assert movement.reference_type == "Reservation"

        assert movement.reference_id == reservation.id

        assert movement_count_after == movement_count_before + 1

        assert audit is not None

        assert audit.entity_type == "Reservation"

        assert audit.entity_id == reservation.id

        assert audit.action == "RESERVATION_EXPIRED"

        assert reservation.cancelled_at is None

        print("\nTEST: PASS")
