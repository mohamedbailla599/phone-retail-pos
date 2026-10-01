from .base import ReservationTestCase

from decimal import Decimal


from django.utils import timezone

from apps.audit.models import AuditLog
from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem, StockMovement
from apps.payments.models import Payment
from apps.payments.services.payments import create_payment
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import (
    activate_reservation,
    complete_reservation,
    create_reservation,
)
from apps.sales.models import Transaction


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Payment Completion Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"PAY-COMP-{self.test_id}",
            name=f"Payment Completion Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Payment Completion Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"40{self.test_id}12345678",
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
            notes="Reservation payment completion test",
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

        customer.refresh_from_db()

        customer_spent_before = customer.total_spent


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
        print(
            "TOTAL:",
            transaction.total_amount,
        )
        print(
            "CUSTOMER TOTAL SPENT:",
            customer_spent_before,
        )


        # ============================================================
        # CREATE FULL CASH PAYMENT
        # ============================================================

        payment = create_payment(
            sale_id=transaction.id,
            amount=Decimal("4800.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )


        payment.refresh_from_db()


        print("\nAFTER PAYMENT")

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


        # ============================================================
        # VERIFY PAYMENT
        # ============================================================

        assert payment.transaction_id == transaction.id

        assert payment.amount == Decimal("4800.00")

        assert payment.method == Payment.Method.CASH

        assert payment.status == Payment.Status.CONFIRMED

        assert payment.confirmed_by_id == self.owner.id

        assert payment.confirmed_at is not None


        # ============================================================
        # VERIFY RESERVATION STILL ACTIVE
        # ============================================================

        reservation.refresh_from_db()
        transaction.refresh_from_db()
        device.refresh_from_db()

        assert reservation.status == Reservation.Status.ACTIVE

        assert transaction.status == Transaction.Status.PENDING_PAYMENT

        assert device.status == DeviceItem.Status.RESERVED


        # ============================================================
        # COUNT MOVEMENTS BEFORE COMPLETION
        # ============================================================

        movement_count_before = StockMovement.objects.filter(
            device=device,
        ).count()


        # ============================================================
        # COMPLETE RESERVATION
        # ============================================================

        complete_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
        )


        # ============================================================
        # REFRESH
        # ============================================================

        reservation.refresh_from_db()
        transaction.refresh_from_db()
        device.refresh_from_db()
        customer.refresh_from_db()


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
        # FIND AUDIT LOG
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
            "COMPLETED AT:",
            reservation.completed_at,
        )

        print(
            "COMPLETED BY:",
            reservation.completed_by_id,
        )

        print(
            "WARRANTY START:",
            transaction.items.first().warranty_start,
        )

        print(
            "WARRANTY END:",
            transaction.items.first().warranty_end,
        )

        print(
            "CUSTOMER TOTAL SPENT:",
            customer.total_spent,
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

        assert reservation.status == Reservation.Status.COMPLETED

        assert transaction.status == Transaction.Status.COMPLETED

        assert device.status == DeviceItem.Status.SOLD

        assert reservation.completed_at is not None

        assert reservation.completed_by_id == self.owner.id

        item = transaction.items.first()

        assert item is not None

        assert item.warranty_start is not None

        assert item.warranty_end is not None

        assert item.warranty_end > item.warranty_start

        assert customer.total_spent == (
            customer_spent_before
            + Decimal("4800.00")
        )

        assert movement is not None

        assert movement.movement_type == StockMovement.MovementType.SOLD

        assert movement.from_status == DeviceItem.Status.RESERVED

        assert movement.to_status == DeviceItem.Status.SOLD

        assert movement.reference_type == "Reservation"

        assert movement.reference_id == reservation.id

        assert movement_count_after == movement_count_before + 1

        assert audit is not None

        print("\nTEST: PASS")
