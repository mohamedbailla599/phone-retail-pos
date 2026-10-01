from .base import ReservationTestCase

from decimal import Decimal


from django.utils import timezone

from apps.audit.models import AuditLog
from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem, StockMovement
from apps.payments.models import Payment
from apps.payments.services.payments import (
    confirm_bank_transfer,
    create_payment,
)
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import (
    activate_reservation,
    complete_reservation,
    create_reservation,
)
from apps.sales.models import Transaction
from core.exceptions import InvalidPayment


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        owner = self.owner


        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Bank Transfer Test Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"BANK-TEST-{self.test_id}",
            name=f"Bank Transfer Test Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Bank Transfer Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"41{self.test_id}12345678",
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
            notes="Reservation bank transfer test",
        )

        activate_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
        )

        reservation.refresh_from_db()
        device.refresh_from_db()

        transaction = reservation.transaction


        print("BEFORE PAYMENT")

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


        # ============================================================
        # CREATE BANK TRANSFER
        # ============================================================

        payment = create_payment(
            sale_id=transaction.id,
            amount=Decimal("4800.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
            reference=f"BANK-REF-{self.test_id}",
        )

        payment.refresh_from_db()


        print("\nAFTER BANK TRANSFER CREATION")

        print(
            "PAYMENT ID:",
            payment.id,
        )

        print(
            "PAYMENT METHOD:",
            payment.method,
        )

        print(
            "PAYMENT STATUS:",
            payment.status,
        )

        print(
            "PAYMENT AMOUNT:",
            payment.amount,
        )

        print(
            "PAYMENT REFERENCE:",
            payment.reference,
        )


        # ============================================================
        # BANK TRANSFER MUST START PENDING
        # ============================================================

        assert payment.transaction_id == transaction.id

        assert payment.amount == Decimal("4800.00")

        assert payment.method == Payment.Method.BANK_TRANSFER

        assert payment.status == Payment.Status.PENDING

        assert payment.confirmed_by_id is None

        assert payment.confirmed_at is None


        # ============================================================
        # RESERVATION MUST STILL BE ACTIVE
        # ============================================================

        reservation.refresh_from_db()
        transaction.refresh_from_db()
        device.refresh_from_db()

        assert reservation.status == Reservation.Status.ACTIVE

        assert transaction.status == Transaction.Status.PENDING_PAYMENT

        assert device.status == DeviceItem.Status.RESERVED


        # ============================================================
        # COMPLETION BEFORE CONFIRMATION MUST FAIL
        # ============================================================

        try:

            complete_reservation(
                reservation_id=reservation.id,
                actor=self.owner,
            )

            raise AssertionError(
                "Reservation should not complete "
                "while bank transfer is still pending."
            )

        except Exception as exc:

            print("\nCOMPLETION BEFORE BANK CONFIRMATION REJECTED")

            print(
                "EXCEPTION:",
                type(exc).__name__,
            )


        # ============================================================
        # VERIFY STILL ACTIVE
        # ============================================================

        reservation.refresh_from_db()
        transaction.refresh_from_db()
        device.refresh_from_db()

        assert reservation.status == Reservation.Status.ACTIVE

        assert transaction.status == Transaction.Status.PENDING_PAYMENT

        assert device.status == DeviceItem.Status.RESERVED


        # ============================================================
        # CONFIRM BANK TRANSFER
        # ============================================================

        confirmed_payment = confirm_bank_transfer(
            payment_id=payment.id,
            actor=owner,
        )

        confirmed_payment.refresh_from_db()


        print("\nAFTER BANK TRANSFER CONFIRMATION")

        print(
            "PAYMENT STATUS:",
            confirmed_payment.status,
        )

        print(
            "CONFIRMED BY:",
            confirmed_payment.confirmed_by_id,
        )

        print(
            "CONFIRMED AT:",
            confirmed_payment.confirmed_at,
        )


        # ============================================================
        # VERIFY CONFIRMATION
        # ============================================================

        assert confirmed_payment.status == Payment.Status.CONFIRMED

        assert confirmed_payment.confirmed_by_id == owner.id

        assert confirmed_payment.confirmed_at is not None


        # ============================================================
        # DEVICE MUST STILL BE RESERVED
        # ============================================================

        reservation.refresh_from_db()
        transaction.refresh_from_db()
        device.refresh_from_db()

        assert reservation.status == Reservation.Status.ACTIVE

        assert transaction.status == Transaction.Status.PENDING_PAYMENT

        assert device.status == DeviceItem.Status.RESERVED


        # ============================================================
        # COMPLETE RESERVATION
        # ============================================================

        movement_count_before = StockMovement.objects.filter(
            device=device,
        ).count()

        complete_reservation(
            reservation_id=reservation.id,
            actor=owner,
        )


        # ============================================================
        # REFRESH
        # ============================================================

        reservation.refresh_from_db()
        transaction.refresh_from_db()
        device.refresh_from_db()


        # ============================================================
        # FIND SOLD MOVEMENT
        # ============================================================

        movement = StockMovement.objects.filter(
            device=device,
            reference_type="Reservation",
            reference_id=reservation.id,
            movement_type=StockMovement.MovementType.SOLD,
        ).order_by("-id").first()


        # ============================================================
        # FIND AUDIT
        # ============================================================

        audit = AuditLog.objects.filter(
            entity_type="Reservation",
            entity_id=reservation.id,
        ).order_by("-id").first()


        # ============================================================
        # OUTPUT
        # ============================================================

        print("\nAFTER COMPLETION")

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
            "PAYMENT STATUS:",
            confirmed_payment.status,
        )

        print(
            "COMPLETED AT:",
            reservation.completed_at,
        )

        print(
            "COMPLETED BY:",
            reservation.completed_by_id,
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
        # FINAL ASSERTIONS
        # ============================================================

        assert reservation.status == Reservation.Status.COMPLETED

        assert transaction.status == Transaction.Status.COMPLETED

        assert device.status == DeviceItem.Status.SOLD

        assert confirmed_payment.status == Payment.Status.CONFIRMED

        assert movement is not None

        assert (
            movement.movement_type
            == StockMovement.MovementType.SOLD
        )

        assert movement.from_status == DeviceItem.Status.RESERVED

        assert movement.to_status == DeviceItem.Status.SOLD

        assert movement.reference_type == "Reservation"

        assert movement.reference_id == reservation.id

        assert movement_count_after == movement_count_before + 1

        assert audit is not None

        print("\nTEST: PASS")
