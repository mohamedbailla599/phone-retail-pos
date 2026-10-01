from .base import ReservationTestCase

from decimal import Decimal


from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.reservations.models import Reservation
from apps.reservations.services.reservations import create_reservation
from apps.sales.models import Transaction, TransactionItem


class ReservationWorkflowTest(ReservationTestCase):
    def test_reservation_workflow(self):
        category = Category.objects.create(
            name=f"Reservation Test Category {self.test_id}",
            is_device=True,
        )

        product = Product.objects.create(
            category=category,
            sku=f"RES-TEST-{self.test_id}",
            name=f"Reservation Test Phone {self.test_id}",
            brand="TestBrand",
            platform=Product.Platform.ANDROID,
            storage_gb=128,
            ram_gb=8,
            is_active=True,
        )

        customer = Customer.objects.create(
            phone_number=f"06{self.test_id[:8]}",
            full_name=f"Reservation Customer {self.test_id}",
        )

        device = DeviceItem.objects.create(
            product=product,
            imei_1=f"35{self.test_id}12345678",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5000.00"),
            minimum_selling_price=Decimal("4500.00"),
            battery_health=None,
            condition=DeviceItem.Condition.A,
            status=DeviceItem.Status.IN_STOCK,
            received_at=timezone.now(),
        )

        print("BEFORE RESERVATION")
        print("DEVICE STATUS:", device.status)

        reservation = create_reservation(
            customer=customer,
            device_id=device.id,
            reserved_price=Decimal("4800.00"),
            actor=self.owner,
            notes="Reservation creation test",
        )

        reservation.refresh_from_db()
        device.refresh_from_db()

        transaction = reservation.transaction

        item = TransactionItem.objects.get(
            transaction=transaction,
        )

        print("\nAFTER RESERVATION")
        print("RESERVATION ID:", reservation.id)
        print("RESERVATION NUMBER:", reservation.reservation_number)
        print("RESERVATION STATUS:", reservation.status)
        print("RESERVED PRICE:", reservation.reserved_price)

        print("TRANSACTION ID:", transaction.id)
        print("TRANSACTION TYPE:", transaction.transaction_type)
        print("TRANSACTION STATUS:", transaction.status)

        print("ITEM ID:", item.id)
        print("ITEM PRODUCT:", item.product_name_snapshot)
        print("ITEM SKU:", item.sku_snapshot)
        print("ITEM PRICE:", item.price_sold)

        print("DEVICE STATUS:", device.status)
        print("EXPIRES AT:", reservation.expires_at)

        assert reservation.status == Reservation.Status.DRAFT

        assert transaction.transaction_type == Transaction.TransactionType.RESERVATION
        assert transaction.status == Transaction.Status.DRAFT

        assert item.device_id == device.id
        assert item.quantity == 1
        assert item.price_sold == Decimal("4800.00")

        assert reservation.reserved_price == Decimal("4800.00")

        # Creation must NOT reserve the physical device yet.
        assert device.status == DeviceItem.Status.IN_STOCK

        assert reservation.expires_at > reservation.reserved_at

        print("\nTEST: PASS")
