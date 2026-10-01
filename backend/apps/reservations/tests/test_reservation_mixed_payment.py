from .base import ReservationTestCase

from decimal import Decimal


from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.payments.models import Payment
from apps.payments.services.payments import (
    create_payment,
    confirm_bank_transfer,
)
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import (
    activate_reservation,
    complete_reservation,
    create_reservation,
)
from core.exceptions import ReservationBalanceRemaining


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Mixed Payment Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"MIXED-PAY-{self.test_id}",
            name=f"Mixed Payment Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=256,
            ram_gb=12,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Mixed Payment Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"66{self.test_id}12345678",
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
            notes="Mixed payment test",
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

        print(
            "TOTAL:",
            transaction.total_amount,
        )

        assert reservation.status == Reservation.Status.ACTIVE
        assert transaction.status == transaction.Status.PENDING_PAYMENT
        assert device.status == DeviceItem.Status.RESERVED
        assert transaction.total_amount == Decimal("4800.00")


        # ============================================================
        # PAYMENT 1 — CASH 1500
        # ============================================================

        cash_payment = create_payment(
            sale_id=transaction.id,
            amount=Decimal("1500.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )

        print("\nAFTER CASH PAYMENT")

        print(
            "PAYMENT ID:",
            cash_payment.id,
        )

        print(
            "PAYMENT METHOD:",
            cash_payment.method,
        )

        print(
            "PAYMENT STATUS:",
            cash_payment.status,
        )

        print(
            "PAYMENT AMOUNT:",
            cash_payment.amount,
        )

        assert cash_payment.status == Payment.Status.CONFIRMED
        assert cash_payment.amount == Decimal("1500.00")


        # ============================================================
        # PAYMENT 2 — BANK TRANSFER 3300
        # ============================================================

        bank_payment = create_payment(
            sale_id=transaction.id,
            amount=Decimal("3300.00"),
            method=Payment.Method.BANK_TRANSFER,
            actor=self.owner,
            reference=f"BANK-MIXED-{self.test_id}",
        )

        print("\nAFTER BANK TRANSFER CREATION")

        print(
            "PAYMENT ID:",
            bank_payment.id,
        )

        print(
            "PAYMENT METHOD:",
            bank_payment.method,
        )

        print(
            "PAYMENT STATUS:",
            bank_payment.status,
        )

        print(
            "PAYMENT AMOUNT:",
            bank_payment.amount,
        )

        print(
            "PAYMENT REFERENCE:",
            bank_payment.reference,
        )

        assert bank_payment.status == Payment.Status.PENDING
        assert bank_payment.amount == Decimal("3300.00")


        # ============================================================
        # VERIFY PAYMENT TOTALS
        # ============================================================

        confirmed_paid = sum(
            Payment.objects.filter(
                transaction=transaction,
                status=Payment.Status.CONFIRMED,
            ).values_list("amount", flat=True)
        )

        pending_paid = sum(
            Payment.objects.filter(
                transaction=transaction,
                status=Payment.Status.PENDING,
            ).values_list("amount", flat=True)
        )

        print("\nPAYMENT SUMMARY")

        print(
            "CONFIRMED PAID:",
            confirmed_paid,
        )

        print(
            "PENDING PAYMENTS:",
            pending_paid,
        )

        print(
            "REMAINING CONFIRMED BALANCE:",
            transaction.total_amount - confirmed_paid,
        )

        assert confirmed_paid == Decimal("1500.00")
        assert pending_paid == Decimal("3300.00")


        # ============================================================
        # COMPLETION MUST FAIL
        # ============================================================

        try:

            complete_reservation(
                reservation_id=reservation.id,
                actor=self.owner,
            )

            raise AssertionError(
                "Reservation must not complete "
                "while bank transfer is pending."
            )

        except ReservationBalanceRemaining as exc:

            print("\nCOMPLETION BEFORE BANK CONFIRMATION REJECTED")

            print(
                "EXCEPTION:",
                type(exc).__name__,
            )

            print(
                "CODE:",
                getattr(exc, "code", None),
            )


        # ============================================================
        # OWNER CONFIRMS BANK TRANSFER
        # ============================================================

        confirmed_bank_payment = confirm_bank_transfer(
            payment_id=bank_payment.id,
            actor=self.owner,
        )

        confirmed_bank_payment.refresh_from_db()

        print("\nAFTER BANK TRANSFER CONFIRMATION")

        print(
            "PAYMENT STATUS:",
            confirmed_bank_payment.status,
        )

        print(
            "CONFIRMED BY:",
            confirmed_bank_payment.confirmed_by_id,
        )

        print(
            "CONFIRMED AT:",
            confirmed_bank_payment.confirmed_at,
        )

        assert confirmed_bank_payment.status == Payment.Status.CONFIRMED
        assert confirmed_bank_payment.confirmed_by_id == self.owner.id
        assert confirmed_bank_payment.confirmed_at is not None


        # ============================================================
        # VERIFY FULL PAYMENT
        # ============================================================

        confirmed_paid = sum(
            Payment.objects.filter(
                transaction=transaction,
                status=Payment.Status.CONFIRMED,
            ).values_list("amount", flat=True)
        )

        print("\nFINAL PAYMENT SUMMARY")

        print(
            "CONFIRMED PAID:",
            confirmed_paid,
        )

        print(
            "TOTAL:",
            transaction.total_amount,
        )

        print(
            "BALANCE:",
            transaction.total_amount - confirmed_paid,
        )

        assert confirmed_paid == Decimal("4800.00")
        assert transaction.total_amount - confirmed_paid == Decimal("0.00")


        # ============================================================
        # COMPLETE RESERVATION
        # ============================================================

        completed_reservation = complete_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
        )

        completed_reservation.refresh_from_db()
        transaction.refresh_from_db()
        device.refresh_from_db()


        print("\nAFTER COMPLETION")

        print(
            "RESERVATION STATUS:",
            completed_reservation.status,
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
            completed_reservation.completed_at,
        )


        # ============================================================
        # FINAL ASSERTIONS
        # ============================================================

        assert completed_reservation.status == Reservation.Status.COMPLETED

        assert transaction.status == transaction.Status.COMPLETED

        assert device.status == DeviceItem.Status.SOLD


        print("\nTEST: PASS")
