from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.exchanges.models import Exchange
from apps.inventory.models import DeviceItem
from apps.payments.models import Payment
from apps.refunds.models import Refund
from apps.sales.models import Transaction, TransactionItem
from apps.users.models import User


class ExchangeAPITestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            username="exchange_api_admin",
            password="testpass123",
            role=User.Role.OWNER,
            is_pos_account=True,
        )

        cls.hassan = User.objects.create_user(
            username="exchange_api_hassan",
            first_name="Hassan",
            role=User.Role.OWNER,
            is_pos_operator=True,
        )

        cls.customer = Customer.objects.create(
            phone_number="0600000099",
            full_name="API Exchange Customer",
        )

        cls.category = Category.objects.create(
            name="API Smartphones",
            is_device=True,
        )

        cls.old_product = Product.objects.create(
            category=cls.category,
            sku="API-OLD-IPHONE",
            name="Old API iPhone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=128,
            is_active=True,
        )

        cls.new_product = Product.objects.create(
            category=cls.category,
            sku="API-NEW-IPHONE",
            name="New API iPhone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=256,
            is_active=True,
        )

        cls.new_device = DeviceItem.objects.create(
            product=cls.new_product,
            imei_1="992222222222222",
            cost_price=Decimal("4000.00"),
            default_selling_price=Decimal("5500.00"),
            minimum_selling_price=Decimal("5000.00"),
            status=DeviceItem.Status.IN_STOCK,
            received_at="2026-09-30T10:00:00Z",
        )

    def setUp(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/auth/operators/select/",
            {"operator_id": self.hassan.id},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    def _create_exchange(
        self,
        old_value="4000.00",
        new_price="5500.00",
        customer_id=None,
    ):
        data = {
            "customer_name": "API Exchange Customer",
            "customer_phone": "0600000099",
            "trade_in_product_id": self.old_product.id,
            "trade_in_imei": "991111111111111",
            "trade_in_condition": "GOOD",
            "trade_in_value": old_value,
            "new_device_id": self.new_device.id,
            "new_device_price": new_price,
            "reason": "API exchange test",
        }
        if customer_id is not None:
            data["customer_id"] = customer_id
        return self.client.post(
            "/api/exchanges/",
            data,
            format="json",
        )

    def _approve_exchange(self, exchange_id):
        response = self.client.post(
            f"/api/exchanges/{exchange_id}/submit/",
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["status"],
            Exchange.Status.UNDER_REVIEW,
        )

        response = self.client.post(
            f"/api/exchanges/{exchange_id}/approve/",
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["status"],
            Exchange.Status.APPROVED,
        )

    def test_unauthenticated_user_cannot_create_exchange(self):
        self.client.force_authenticate(user=None)

        response = self._create_exchange()

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_authenticated_user_without_selected_operator_cannot_create_exchange(
        self,
    ):
        self.client.force_authenticate(user=self.admin)
        self.client.post("/api/auth/operators/clear/")

        response = self.client.post(
            "/api/exchanges/",
            {
                "customer_name": "API Exchange Customer",
                "customer_phone": "0600000099",
                "trade_in_product_id": self.old_product.id,
                "trade_in_imei": "991111111111111",
                "trade_in_condition": "GOOD",
                "trade_in_value": "4000.00",
                "new_device_id": self.new_device.id,
                "new_device_price": "5500.00",
                "reason": "API exchange test",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_invalid_customer_returns_404(self):
        response = self.client.post(
            "/api/exchanges/",
            {
                "customer_id": 999999,
                "customer_name": "API Exchange Customer",
                "customer_phone": "0600000099",
                "trade_in_product_id": self.old_product.id,
                "trade_in_imei": "991111111111111",
                "trade_in_condition": "GOOD",
                "trade_in_value": "4000.00",
                "new_device_id": self.new_device.id,
                "new_device_price": "5500.00",
                "reason": "API exchange test",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            response.data["detail"],
            "Customer not found.",
        )

    def test_owner_can_create_exchange(self):
        response = self._create_exchange(customer_id=self.customer.id)

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            response.data["customer"],
            self.customer.id,
        )
        self.assertEqual(
            response.data["trade_in_product"],
            self.old_product.id,
        )
        self.assertEqual(
            response.data["new_device"],
            self.new_device.id,
        )
        self.assertEqual(
            Decimal(str(response.data["trade_in_value"])),
            Decimal("4000.00"),
        )
        self.assertEqual(
            Decimal(str(response.data["new_device_price"])),
            Decimal("5500.00"),
        )
        self.assertEqual(
            Decimal(str(response.data["difference_amount"])),
            Decimal("1500.00"),
        )
        self.assertEqual(
            response.data["financial_direction"],
            Exchange.FinancialDirection.CUSTOMER_PAYS,
        )
        self.assertEqual(
            response.data["status"],
            Exchange.Status.REQUESTED,
        )
        self.assertEqual(
            response.data["reason"],
            "API exchange test",
        )
        self.assertEqual(
            Exchange.objects.count(),
            1,
        )

    def test_customer_pays_complete_flow(self):
        response = self._create_exchange(
            "4000.00",
            "5500.00",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        exchange_id = response.data["id"]

        self._approve_exchange(exchange_id)

        response = self.client.post(
            f"/api/exchanges/{exchange_id}/payment/",
            {
                "amount": "1500.00",
                "method": Payment.Method.CASH,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            response.data["payment"]["status"],
            Payment.Status.CONFIRMED,
        )
        self.assertEqual(
            Decimal(
                str(response.data["transaction"]["total_amount"])
            ),
            Decimal("1500.00"),
        )

        response = self.client.get(
            f"/api/exchanges/{exchange_id}/payment-status/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            Decimal(str(response.data["confirmed_amount"])),
            Decimal("1500.00"),
        )
        self.assertTrue(
            response.data["fully_paid"],
        )

        response = self.client.post(
            f"/api/exchanges/{exchange_id}/complete/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["exchange"]["status"],
            Exchange.Status.COMPLETED,
        )

        exchange = Exchange.objects.get(
            id=exchange_id,
        )
        self.new_device.refresh_from_db()

        self.assertEqual(
            exchange.status,
            Exchange.Status.COMPLETED,
        )
        self.assertEqual(
            exchange.trade_in_device_item.status,
            DeviceItem.Status.IN_STOCK,
        )
        self.assertEqual(
            self.new_device.status,
            DeviceItem.Status.SOLD,
        )

    def test_store_refund_complete_flow(self):
        response = self._create_exchange(
            "5000.00",
            "4000.00",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        exchange_id = response.data["id"]

        self._approve_exchange(exchange_id)

        response = self.client.post(
            f"/api/exchanges/{exchange_id}/refund/",
            {
                "method": Refund.Method.CASH,
                "reason": "API exchange refund",
                "notes": "Refund difference",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            Decimal(str(response.data["refund"]["amount"])),
            Decimal("1000.00"),
        )
        self.assertEqual(
            response.data["refund"]["method"],
            Refund.Method.CASH,
        )
        self.assertEqual(
            response.data["refund"]["status"],
            Refund.Status.REQUESTED,
        )

        refund_id = response.data["refund"]["id"]

        response = self.client.post(
            f"/api/exchanges/refunds/{refund_id}/complete/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["refund"]["status"],
            Refund.Status.COMPLETED,
        )

        response = self.client.post(
            f"/api/exchanges/{exchange_id}/complete/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["exchange"]["status"],
            Exchange.Status.COMPLETED,
        )

        exchange = Exchange.objects.get(
            id=exchange_id,
        )
        self.new_device.refresh_from_db()

        self.assertEqual(
            exchange.status,
            Exchange.Status.COMPLETED,
        )
        self.assertEqual(
            exchange.trade_in_device_item.status,
            DeviceItem.Status.IN_STOCK,
        )
        self.assertEqual(
            self.new_device.status,
            DeviceItem.Status.SOLD,
        )

    def test_even_exchange_complete_flow(self):
        response = self._create_exchange(
            "5000.00",
            "5000.00",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )
        exchange_id = response.data["id"]

        self.assertEqual(
            response.data["financial_direction"],
            Exchange.FinancialDirection.EVEN,
        )
        self.assertEqual(
            Decimal(str(response.data["difference_amount"])),
            Decimal("0.00"),
        )

        self._approve_exchange(exchange_id)

        response = self.client.get(
            f"/api/exchanges/{exchange_id}/payment-status/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertIsNone(
            response.data["transaction"],
        )
        self.assertEqual(
            Decimal(str(response.data["confirmed_amount"])),
            Decimal("0.00"),
        )
        self.assertFalse(
            response.data["fully_paid"],
        )

        response = self.client.post(
            f"/api/exchanges/{exchange_id}/complete/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["exchange"]["status"],
            Exchange.Status.COMPLETED,
        )

        exchange = Exchange.objects.get(
            id=exchange_id,
        )
        self.new_device.refresh_from_db()

        self.assertEqual(
            exchange.status,
            Exchange.Status.COMPLETED,
        )
        self.assertEqual(
            exchange.trade_in_device_item.status,
            DeviceItem.Status.IN_STOCK,
        )
        self.assertEqual(
            self.new_device.status,
            DeviceItem.Status.SOLD,
        )