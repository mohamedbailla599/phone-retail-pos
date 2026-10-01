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
    create_reservation,
)
from core.exceptions import InvalidPayment


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Overpayment Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"OVERPAY-{self.test_id}",
            name=f"Overpayment Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Overpayment Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"77{self.test_id}12345678",
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
            notes="Overpayment protection test",
        )

        activate_reservation(
            reservation_id=reservation.id,
            actor=self.owner,
        )

        reservation.refresh_from_db()

        transaction = reservation.transaction

        print("RESERVATION")

        print(
            "STATUS:",
            reservation.status,
        )

        print(
            "TOTAL:",
            transaction.total_amount,
        )

        assert reservation.status == Reservation.Status.ACTIVE
        assert transaction.total_amount == Decimal("4800.00")


        # ============================================================
        # FIRST PAYMENT
        # ============================================================

        first_payment = create_payment(
            sale_id=transaction.id,
            amount=Decimal("3000.00"),
            method=Payment.Method.CASH,
            actor=self.owner,
        )

        print("\nFIRST PAYMENT")

        print(
            "PAYMENT ID:",
            first_payment.id,
        )

        print(
            "AMOUNT:",
            first_payment.amount,
        )

        print(
            "STATUS:",
            first_payment.status,
        )

        assert first_payment.status == Payment.Status.CONFIRMED


        # ============================================================
        # VERIFY REMAINING BALANCE
        # ============================================================

        confirmed_before = sum(
            Payment.objects.filter(
                transaction=transaction,
                status=Payment.Status.CONFIRMED,
            ).values_list("amount", flat=True)
        )

        remaining_before = (
            transaction.total_amount - confirmed_before
        )

        print("\nBEFORE OVERPAYMENT")

        print(
            "CONFIRMED PAID:",
            confirmed_before,
        )

        print(
            "REMAINING BALANCE:",
            remaining_before,
        )

        assert confirmed_before == Decimal("3000.00")
        assert remaining_before == Decimal("1800.00")


        # ============================================================
        # COUNT PAYMENTS BEFORE INVALID PAYMENT
        # ============================================================

        payments_before = Payment.objects.filter(
            transaction=transaction
        ).count()


        # ============================================================
        # OVERPAYMENT MUST FAIL
        # ============================================================

        try:

            create_payment(
                sale_id=transaction.id,
                amount=Decimal("1800.01"),
                method=Payment.Method.CASH,
                actor=self.owner,
            )

            raise AssertionError(
                "Payment above the remaining balance "
                "must be rejected."
            )

        except InvalidPayment as exc:

            print("\nOVERPAYMENT REJECTED")

            print(
                "EXCEPTION:",
                type(exc).__name__,
            )

            print(
                "CODE:",
                getattr(exc, "code", None),
            )


        # ============================================================
        # VERIFY NO PAYMENT WAS CREATED
        # ============================================================

        payments_after = Payment.objects.filter(
            transaction=transaction
        ).count()

        confirmed_after = sum(
            Payment.objects.filter(
                transaction=transaction,
                status=Payment.Status.CONFIRMED,
            ).values_list("amount", flat=True)
        )

        print("\nAFTER REJECTED OVERPAYMENT")

        print(
            "PAYMENTS BEFORE:",
            payments_before,
        )

        print(
            "PAYMENTS AFTER:",
            payments_after,
        )

        print(
            "CONFIRMED PAID:",
            confirmed_after,
        )

        print(
            "REMAINING BALANCE:",
            transaction.total_amount - confirmed_after,
        )


        assert payments_after == payments_before

        assert confirmed_after == Decimal("3000.00")

        assert (
            transaction.total_amount - confirmed_after
            == Decimal("1800.00")
        )


        # ============================================================
        # DEVICE MUST REMAIN RESERVED
        # ============================================================

        device.refresh_from_db()

        print(
            "DEVICE STATUS:",
            device.status,
        )

        assert device.status == DeviceItem.Status.RESERVED


        print("\nTEST: PASS")
