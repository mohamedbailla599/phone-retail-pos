from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.exchanges.models import Exchange
from apps.inventory.models import DeviceItem
from apps.refunds.models import Refund
from apps.sales.models import Transaction, TransactionItem


User = get_user_model()


class ExchangeAPITestCase(APITestCase):

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="exchange_api_owner",
            password="testpass123",
            role=User.Role.OWNER,
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
            name="API Old iPhone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=128,
            is_active=True,
        )

        cls.new_product = Product.objects.create(
            category=cls.category,
            sku="API-NEW-IPHONE",
            name="API New iPhone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=256,
            is_active=True,
        )

        cls.old_device = DeviceItem.objects.create(
            product=cls.old_product,
            imei_1="991111111111111",
            cost_price=Decimal("3000.00"),
            default_selling_price=Decimal("4000.00"),
            minimum_selling_price=Decimal("3500.00"),
            status=DeviceItem.Status.SOLD,
            received_at="2026-09-30T10:00:00Z",
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

        cls.sale = Transaction.objects.create(
            receipt_id="BP-API-EX-001",
            customer=cls.customer,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.COMPLETED,
            subtotal=Decimal("4000.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("4000.00"),
            created_by=cls.owner,
        )

        TransactionItem.objects.create(
            transaction=cls.sale,
            device=cls.old_device,
            product_name_snapshot=cls.old_device.product.name,
            sku_snapshot=cls.old_device.product.sku,
            quantity=1,
            unit_price=Decimal("4000.00"),
            price_sold=Decimal("4000.00"),
            line_total=Decimal("4000.00"),
            cost_price_at_sale=cls.old_device.cost_price,
        )


    def _create_exchange(
        self,
        *,
        old_value="4000.00",
        new_price="5500.00",
        reason="Customer wants an upgrade.",
    ):
        payload = {
            "customer_id": self.customer.id,
            "original_transaction_id": self.sale.id,
            "old_device_id": self.old_device.id,
            "new_device_id": self.new_device.id,
            "old_device_value": old_value,
            "new_device_price": new_price,
            "reason": reason,
        }

        response = self.client.post(
            "/api/exchanges/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        return response.data

            

    def _approve_exchange(self, exchange_id):
        response = self.client.post(
            f"/api/exchanges/{exchange_id}/submit/",
            {},
            format="json",
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
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["status"],
            Exchange.Status.APPROVED,
        )

        return response.data

    def test_unauthenticated_user_cannot_create_exchange(self):
        payload = {
            "customer_id": self.customer.id,
            "original_transaction_id": self.sale.id,
            "old_device_id": self.old_device.id,
            "new_device_id": self.new_device.id,
            "old_device_value": "4000.00",
            "new_device_price": "5500.00",
            "reason": "Customer wants an upgrade.",
        }

        response = self.client.post(
            "/api/exchanges/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_owner_cannot_create_exchange_with_invalid_customer(self):
        self.client.force_authenticate(user=self.owner)

        payload = {
            "customer_id": 999999,
            "original_transaction_id": self.sale.id,
            "old_device_id": self.old_device.id,
            "new_device_id": self.new_device.id,
            "old_device_value": "4000.00",
            "new_device_price": "5500.00",
            "reason": "Customer wants an upgrade.",
        }

        response = self.client.post(
            "/api/exchanges/",
            payload,
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

    def test_owner_can_create_valid_exchange(self):
        self.client.force_authenticate(user=self.owner)

        payload = {
            "customer_id": self.customer.id,
            "original_transaction_id": self.sale.id,
            "old_device_id": self.old_device.id,
            "new_device_id": self.new_device.id,
            "old_device_value": "4000.00",
            "new_device_price": "5500.00",
            "reason": "Customer wants an upgrade.",
        }

        response = self.client.post(
            "/api/exchanges/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            response.data["customer"],
            self.customer.id,
        )

        self.assertEqual(
            response.data["original_transaction"],
            self.sale.id,
        )

        self.assertEqual(
            response.data["old_device"],
            self.old_device.id,
        )

        self.assertEqual(
            response.data["new_device"],
            self.new_device.id,
        )

        self.assertEqual(
            response.data["old_device_value"],
            "4000.00",
        )

        self.assertEqual(
            response.data["new_device_price"],
            "5500.00",
        )

        self.assertEqual(
            response.data["difference_amount"],
            "1500.00",
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
            "Customer wants an upgrade.",
        )

        self.assertEqual(
            Exchange.objects.count(),
            1,
        )

    def test_customer_pays_exchange_complete_api_flow(self):
            

            exchange_data = self._create_exchange(
                old_value="4000.00",
                new_price="5500.00",
            )

            exchange_id = exchange_data["id"]

            self._approve_exchange(exchange_id)

            payment_response = self.client.post(
                f"/api/exchanges/{exchange_id}/payment/",
                {
                    "amount": "1500.00",
                    "method": "CASH",
                },
                format="json",
            )

            self.assertEqual(
                payment_response.status_code,
                status.HTTP_201_CREATED,
            )

            self.assertEqual(
                payment_response.data["exchange_id"],
                exchange_id,
            )

            self.assertEqual(
                payment_response.data["payment"]["amount"],
                "1500.00",
            )

            self.assertEqual(
                payment_response.data["payment"]["method"],
                "CASH",
            )

            self.assertEqual(
                payment_response.data["payment"]["status"],
                "CONFIRMED",
            )

            self.assertEqual(
                payment_response.data["transaction"]["total_amount"],
                "1500.00",
            )

            payment_status_response = self.client.get(
                f"/api/exchanges/{exchange_id}/payment-status/",
            )

            self.assertEqual(
                payment_status_response.status_code,
                status.HTTP_200_OK,
            )

            self.assertEqual(
                payment_status_response.data["exchange_id"],
                exchange_id,
            )

            self.assertEqual(
                payment_status_response.data["confirmed_amount"],
                "1500.00",
            )

            self.assertTrue(
                payment_status_response.data["fully_paid"]
            )

            complete_response = self.client.post(
                f"/api/exchanges/{exchange_id}/complete/",
                {},
                format="json",
            )

            self.assertEqual(
                complete_response.status_code,
                status.HTTP_200_OK,
            )

            self.assertEqual(
                complete_response.data["exchange"]["status"],
                Exchange.Status.COMPLETED,
            )

            self.old_device.refresh_from_db()
            self.new_device.refresh_from_db()

            self.assertEqual(
                self.old_device.status,
                DeviceItem.Status.IN_STOCK,
            )

            self.assertEqual(
                self.new_device.status,
                DeviceItem.Status.SOLD,
            )

    def test_store_refund_exchange_complete_api_flow(self):
            

            exchange_data = self._create_exchange(
                old_value="5000.00",
                new_price="4000.00",
                reason="Customer wants a cheaper device.",
            )

            exchange_id = exchange_data["id"]

            self._approve_exchange(exchange_id)

            refund_response = self.client.post(
                f"/api/exchanges/{exchange_id}/refund/",
                {
                    "method": "CASH",
                    "reason": "Exchange refund",
                    "notes": "Refund approved by owner.",
                },
                format="json",
            )

            self.assertEqual(
                refund_response.status_code,
                status.HTTP_201_CREATED,
            )

            self.assertEqual(
                refund_response.data["exchange_id"],
                exchange_id,
            )

            self.assertEqual(
                refund_response.data["refund"]["amount"],
                "1000.00",
            )

            self.assertEqual(
                refund_response.data["refund"]["method"],
                Refund.Method.CASH,
            )

            self.assertEqual(
                refund_response.data["refund"]["status"],
                Refund.Status.REQUESTED,
            )

            refund_id = refund_response.data["refund"]["id"]

            complete_refund_response = self.client.post(
                f"/api/exchanges/refunds/{refund_id}/complete/",
                {},
                format="json",
            )

            self.assertEqual(
                complete_refund_response.status_code,
                status.HTTP_200_OK,
            )

            self.assertEqual(
                complete_refund_response.data["refund"]["id"],
                refund_id,
            )

            self.assertEqual(
                complete_refund_response.data["refund"]["status"],
                Refund.Status.COMPLETED,
            )

            complete_response = self.client.post(
                f"/api/exchanges/{exchange_id}/complete/",
                {},
                format="json",
            )

            self.assertEqual(
                complete_response.status_code,
                status.HTTP_200_OK,
            )

            self.assertEqual(
                complete_response.data["exchange"]["status"],
                Exchange.Status.COMPLETED,
            )

            self.old_device.refresh_from_db()
            self.new_device.refresh_from_db()

            self.assertEqual(
                self.old_device.status,
                DeviceItem.Status.IN_STOCK,
            )

            self.assertEqual(
                self.new_device.status,
                DeviceItem.Status.SOLD,
            )

    def test_even_exchange_complete_api_flow(self):
            self.client.force_authenticate(user=self.owner)

            exchange_data = self._create_exchange(
                old_value="5000.00",
                new_price="5000.00",
                reason="Even exchange.",
            )

            exchange_id = exchange_data["id"]

            self.assertEqual(
                exchange_data["financial_direction"],
                Exchange.FinancialDirection.EVEN,
            )

            self.assertEqual(
                exchange_data["difference_amount"],
                "0.00",
            )

            self._approve_exchange(exchange_id)

            payment_status_response = self.client.get(
                f"/api/exchanges/{exchange_id}/payment-status/",
            )

            # An EVEN exchange does not require a financial transaction.
            self.assertEqual(
                payment_status_response.status_code,
                status.HTTP_200_OK,
            )

            self.assertIsNone(
                payment_status_response.data["transaction"],
            )

            self.assertEqual(
                payment_status_response.data["confirmed_amount"],
                "0.00",
            )

            self.assertFalse(
                payment_status_response.data["fully_paid"],
            )

            complete_response = self.client.post(
                f"/api/exchanges/{exchange_id}/complete/",
                {},
                format="json",
            )

            self.assertEqual(
                complete_response.status_code,
                status.HTTP_200_OK,
            )

            self.assertEqual(
                complete_response.data["exchange"]["status"],
                Exchange.Status.COMPLETED,
            )

            self.old_device.refresh_from_db()
            self.new_device.refresh_from_db()

            self.assertEqual(
                self.old_device.status,
                DeviceItem.Status.IN_STOCK,
            )

            self.assertEqual(
                self.new_device.status,
                DeviceItem.Status.SOLD,
            )