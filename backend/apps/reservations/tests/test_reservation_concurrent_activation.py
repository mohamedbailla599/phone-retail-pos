from .base import ReservationTestCase

from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal


from django.db import close_old_connections
from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem, StockMovement
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import (
    activate_reservation,
    create_reservation,
)


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        # ============================================================
        # CREATE TEST DATA
        # ============================================================

        category = Category.objects.create(
            name=f"Concurrent Activation Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"CONCURRENT-ACT-{self.test_id}",
            name=f"Concurrent Activation Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Concurrent Activation Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"99{self.test_id}12345678",
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
            notes="Concurrent activation test",
        )

        reservation.refresh_from_db()
        device.refresh_from_db()

        print("BEFORE CONCURRENT ACTIVATION")

        print(
            "RESERVATION STATUS:",
            reservation.status,
        )

        print(
            "TRANSACTION STATUS:",
            reservation.transaction.status,
        )

        print(
            "DEVICE STATUS:",
            device.status,
        )

        assert reservation.status == Reservation.Status.DRAFT

        assert (
            reservation.transaction.status
            == reservation.transaction.Status.DRAFT
        )

        assert device.status == DeviceItem.Status.IN_STOCK


        # ============================================================
        # WORKER
        # ============================================================

        def attempt_activation(label):

            close_old_connections()

            try:

                activated = activate_reservation(
                    reservation_id=reservation.id,
                    actor=self.owner,
                )

                return {
                    "label": label,
                    "success": True,
                    "exception": None,
                    "code": None,
                    "message": None,
                    "reservation_status": activated.status,
                }

            except Exception as exc:

                return {
                    "label": label,
                    "success": False,
                    "exception": type(exc).__name__,
                    "code": getattr(exc, "code", None),
                    "message": str(exc),
                    "reservation_status": None,
                }

            finally:
                close_old_connections()


        # ============================================================
        # CONCURRENT ACTIVATION
        # ============================================================

        print("\nSTARTING CONCURRENT ACTIVATION")

        print("THREAD A → ACTIVATE")
        print("THREAD B → ACTIVATE")

        results = []

        with ThreadPoolExecutor(max_workers=2) as executor:

            futures = [
                executor.submit(
                    attempt_activation,
                    "THREAD A",
                ),
                executor.submit(
                    attempt_activation,
                    "THREAD B",
                ),
            ]

            for future in as_completed(futures):

                results.append(
                    future.result()
                )


        # ============================================================
        # RESULTS
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
                    "  RESERVATION STATUS:",
                    result["reservation_status"],
                )

            else:

                print(
                    "  EXCEPTION:",
                    result["exception"],
                )

                print(
                    "  CODE:",
                    result["code"],
                )

                print(
                    "  MESSAGE:",
                    result["message"],
                )


        # ============================================================
        # FINAL DATABASE STATE
        # ============================================================

        reservation.refresh_from_db()
        transaction = reservation.transaction
        transaction.refresh_from_db()
        device.refresh_from_db()


        print("\nFINAL DATABASE STATE")

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
        # STOCK MOVEMENTS
        # ============================================================

        reserved_movements = StockMovement.objects.filter(
            device=device,
            movement_type=StockMovement.MovementType.RESERVED,
        )

        reserved_count = reserved_movements.count()

        print(
            "RESERVED MOVEMENTS:",
            reserved_count,
        )


        for movement in reserved_movements:

            print(
                "  MOVEMENT ID:",
                movement.id,
            )

            print(
                "  FROM:",
                movement.from_status,
            )

            print(
                "  TO:",
                movement.to_status,
            )

            print(
                "  REFERENCE ID:",
                movement.reference_id,
            )


        # ============================================================
        # ASSERTIONS
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


        assert len(successful_threads) == 1, (
            f"Expected exactly one successful activation, "
            f"got {len(successful_threads)}"
        )

        assert len(rejected_threads) == 1, (
            f"Expected exactly one rejected activation, "
            f"got {len(rejected_threads)}"
        )


        assert reservation.status == Reservation.Status.ACTIVE

        assert (
            transaction.status
            == transaction.Status.PENDING_PAYMENT
        )

        assert device.status == DeviceItem.Status.RESERVED


        # Exactly one reservation movement must exist.

        assert reserved_count == 1, (
            f"Expected exactly one RESERVED movement, "
            f"got {reserved_count}"
        )


        movement = reserved_movements.first()

        assert movement.from_status == DeviceItem.Status.IN_STOCK

        assert movement.to_status == DeviceItem.Status.RESERVED

        assert movement.reference_id == reservation.id


        print("\nCONCURRENCY CHECK")

        print(
            "SUCCESSFUL THREADS:",
            len(successful_threads),
        )

        print(
            "REJECTED THREADS:",
            len(rejected_threads),
        )

        print(
            "RESERVED MOVEMENTS:",
            reserved_count,
        )

        print(
            "FINAL DEVICE STATUS:",
            device.status,
        )

        print("\nTEST: PASS")
