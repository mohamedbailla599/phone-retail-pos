from .base import ReservationTestCase

from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed


from django.db import close_old_connections
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
            name=f"Concurrent Payment Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"CONCURRENT-PAY-{self.test_id}",
            name=f"Concurrent Payment Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=256,
            ram_gb=12,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Concurrent Payment Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"88{self.test_id}12345678",
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
            notes="Concurrent payment test",
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
        # PAYMENT WORKER
        # ============================================================

        def attempt_payment(amount, label):
            """
            Each worker gets its own Django DB connection.
            """

            close_old_connections()

            try:
                payment = create_payment(
                    sale_id=transaction.id,
                    amount=amount,
                    method=Payment.Method.CASH,
                    actor=self.owner,
                )

                return {
                    "label": label,
                    "success": True,
                    "payment_id": payment.id,
                    "amount": payment.amount,
                    "status": payment.status,
                    "exception": None,
                }

            except Exception as exc:

                return {
                    "label": label,
                    "success": False,
                    "payment_id": None,
                    "amount": amount,
                    "status": None,
                    "exception": type(exc).__name__,
                    "code": getattr(exc, "code", None),
                    "message": str(exc),
                }

            finally:
                close_old_connections()


        # ============================================================
        # RUN TWO PAYMENTS CONCURRENTLY
        # ============================================================

        print("\nSTARTING CONCURRENT PAYMENTS")

        print("THREAD A: 3000.00 DH")
        print("THREAD B: 2500.00 DH")

        results = []

        with ThreadPoolExecutor(max_workers=2) as executor:

            futures = [
                executor.submit(
                    attempt_payment,
                    Decimal("3000.00"),
                    "THREAD A",
                ),
                executor.submit(
                    attempt_payment,
                    Decimal("2500.00"),
                    "THREAD B",
                ),
            ]

            for future in as_completed(futures):
                results.append(future.result())


        # ============================================================
        # PRINT RESULTS
        # ============================================================

        print("\nTHREAD RESULTS")

        for result in results:

            print(
                result["label"],
                "→",
                "SUCCESS" if result["success"] else "REJECTED",
            )

            if result["success"]:

                print(
                    "  PAYMENT ID:",
                    result["payment_id"],
                )

                print(
                    "  AMOUNT:",
                    result["amount"],
                )

                print(
                    "  STATUS:",
                    result["status"],
                )

            else:

                print(
                    "  EXCEPTION:",
                    result["exception"],
                )

                print(
                    "  CODE:",
                    result.get("code"),
                )

                print(
                    "  MESSAGE:",
                    result.get("message"),
                )


        # ============================================================
        # VERIFY DATABASE STATE
        # ============================================================

        transaction.refresh_from_db()

        payments = list(
            Payment.objects.filter(
                transaction=transaction
            ).order_by("id")
        )

        confirmed_payments = [
            payment
            for payment in payments
            if payment.status == Payment.Status.CONFIRMED
        ]

        confirmed_total = sum(
            payment.amount
            for payment in confirmed_payments
        )

        print("\nFINAL DATABASE STATE")

        print(
            "PAYMENT RECORDS:",
            len(payments),
        )

        print(
            "CONFIRMED PAYMENTS:",
            len(confirmed_payments),
        )

        print(
            "CONFIRMED TOTAL:",
            confirmed_total,
        )

        print(
            "TRANSACTION TOTAL:",
            transaction.total_amount,
        )

        print(
            "REMAINING BALANCE:",
            transaction.total_amount - confirmed_total,
        )


        # ============================================================
        # BUSINESS INVARIANTS
        # ============================================================

        successful_threads = [
            result
            for result in results
            if result["success"]
        ]

        rejected_threads = [
            result
            for result in results
            if not result["success"]
        ]


        # Exactly one should succeed because:
        #
        # 3000 + 2500 = 5500
        # Reservation total = 4800
        #
        # Whichever thread gets the lock first succeeds.
        # The second thread sees the updated balance and must fail.

        assert len(successful_threads) == 1, (
            f"Expected exactly one successful payment, "
            f"got {len(successful_threads)}"
        )

        assert len(rejected_threads) == 1, (
            f"Expected exactly one rejected payment, "
            f"got {len(rejected_threads)}"
        )


        assert len(confirmed_payments) == 1

        assert confirmed_total in (
            Decimal("3000.00"),
            Decimal("2500.00"),
        )

        assert confirmed_total <= transaction.total_amount


        # The reservation must still be active because
        # payment alone does not complete it.

        reservation.refresh_from_db()
        device.refresh_from_db()

        assert reservation.status == Reservation.Status.ACTIVE

        assert device.status == DeviceItem.Status.RESERVED


        print("\nCONCURRENCY CHECK")

        print("SUCCESSFUL THREADS:", len(successful_threads))
        print("REJECTED THREADS:", len(rejected_threads))
        print("CONFIRMED TOTAL:", confirmed_total)
        print("MAX ALLOWED:", transaction.total_amount)

        print("\nTEST: PASS")
