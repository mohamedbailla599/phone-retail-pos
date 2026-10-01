from .base import ReservationTestCase

from decimal import Decimal


from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.payments.models import Payment
from apps.payments.services.payments import create_payment
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
        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Partial Payment Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"PARTIAL-TEST-{self.test_id}",
            name=f"Partial Payment Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Partial Payment Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"42{self.test_id}12345678",
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
            notes="Partial payment reservation test",
        )

        activate_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
        )

        reservation.refresh_from_db()
        device.refresh_from_db()

        transaction = reservation.transaction


        print("INITIAL STATE")

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


        # ============================================================
        # FIRST PAYMENT — DEPOSIT
        # ============================================================

        first_payment = create_payment(
            sale_id=transaction.id,
            amount=Decimal("1500.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )

        first_payment.refresh_from_db()


        print("\nAFTER FIRST PAYMENT")

        print(
            "PAYMENT ID:",
            first_payment.id,
        )

        print(
            "PAYMENT AMOUNT:",
            first_payment.amount,
        )

        print(
            "PAYMENT STATUS:",
            first_payment.status,
        )


        # ============================================================
        # VERIFY FIRST PAYMENT
        # ============================================================

        assert first_payment.amount == Decimal("1500.00")

        assert first_payment.status == Payment.Status.CONFIRMED

        assert first_payment.method == Payment.Method.CASH


        # ============================================================
        # VERIFY REMAINING BALANCE
        # ============================================================

        confirmed_paid = sum(
            payment.amount
            for payment in transaction.payments.filter(
                status=Payment.Status.CONFIRMED
            )
        )

        remaining_balance = (
            transaction.total_amount
            - confirmed_paid
        )


        print(
            "CONFIRMED PAID:",
            confirmed_paid,
        )

        print(
            "REMAINING BALANCE:",
            remaining_balance,
        )


        assert confirmed_paid == Decimal("1500.00")

        assert remaining_balance == Decimal("3300.00")


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
        # COMPLETION MUST FAIL WITH REMAINING BALANCE
        # ============================================================

        try:

            complete_reservation(
                reservation_id=reservation.id,
                actor=self.owner,
            )

            raise AssertionError(
                "Reservation should not complete "
                "while balance remains."
            )

        except Exception as exc:

            print(
                "\nCOMPLETION WITH REMAINING BALANCE REJECTED"
            )

            print(
                "EXCEPTION:",
                type(exc).__name__,
            )


        # ============================================================
        # SECOND PAYMENT — REMAINING BALANCE
        # ============================================================

        second_payment = create_payment(
            sale_id=transaction.id,
            amount=Decimal("3300.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )

        second_payment.refresh_from_db()


        print("\nAFTER SECOND PAYMENT")

        print(
            "PAYMENT ID:",
            second_payment.id,
        )

        print(
            "PAYMENT AMOUNT:",
            second_payment.amount,
        )

        print(
            "PAYMENT STATUS:",
            second_payment.status,
        )


        assert second_payment.amount == Decimal("3300.00")

        assert second_payment.status == Payment.Status.CONFIRMED


        # ============================================================
        # VERIFY FULL PAYMENT
        # ============================================================

        confirmed_paid = sum(
            payment.amount
            for payment in transaction.payments.filter(
                status=Payment.Status.CONFIRMED
            )
        )

        remaining_balance = (
            transaction.total_amount
            - confirmed_paid
        )


        print(
            "TOTAL CONFIRMED PAID:",
            confirmed_paid,
        )

        print(
            "FINAL REMAINING BALANCE:",
            remaining_balance,
        )


        assert confirmed_paid == Decimal("4800.00")

        assert remaining_balance == Decimal("0.00")


        # ============================================================
        # OVERPAYMENT MUST BE REJECTED
        # ============================================================

        try:

            create_payment(
                sale_id=transaction.id,
                amount=Decimal("1.00"),
                method=Payment.Method.CASH,
                actor=self.owner,
            )

            raise AssertionError(
                "Overpayment should have been rejected."
            )

        except InvalidPayment as exc:

            print("\nOVERPAYMENT REJECTED")

            print(
                "EXCEPTION:",
                type(exc).__name__,
            )

            print(
                "MESSAGE:",
                str(exc),
            )


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


        # ============================================================
        # OUTPUT
        # ============================================================

        print("\nFINAL STATE")

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
        # FINAL ASSERTIONS
        # ============================================================

        assert reservation.status == Reservation.Status.COMPLETED

        assert transaction.status == Transaction.Status.COMPLETED

        assert device.status == DeviceItem.Status.SOLD

        print("\nTEST: PASS")
