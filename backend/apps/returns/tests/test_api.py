from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Product
from apps.customers.models import Customer
from apps.inventory.models import DeviceItem
from apps.returns.models import Return
from apps.sales.models import Transaction, TransactionItem
from apps.users.models import User


class ReturnAPITestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            username="return_api_admin",
            password="testpass123",
            role=User.Role.OWNER,
            is_pos_account=True,
        )

        cls.hassan = User.objects.create_user(
            username="return_api_hassan",
            first_name="Hassan",
            role=User.Role.OWNER,
            is_pos_operator=True,
        )

        cls.customer = Customer.objects.create(
            phone_number="0600000099",
            full_name="API Return Customer",
        )

        cls.category = Category.objects.create(
            name="API Smartphones",
            is_device=True,
        )

        cls.product = Product.objects.create(
            category=cls.category,
            sku="API-IPHONE",
            name="API iPhone",
            brand="Apple",
            platform=Product.Platform.APPLE,
            storage_gb=128,
            is_active=True,
        )

        cls.device = DeviceItem.objects.create(
            product=cls.product,
            imei_1="991111111111111",
            cost_price=Decimal("3000.00"),
            default_selling_price=Decimal("4000.00"),
            minimum_selling_price=Decimal("3500.00"),
            status=DeviceItem.Status.SOLD,
            received_at="2026-09-30T10:00:00Z",
        )

        cls.sale = Transaction.objects.create(
            receipt_id="BP-API-RT-001",
            customer=cls.customer,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.COMPLETED,
            subtotal=Decimal("4000.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("4000.00"),
            created_by=cls.hassan,
        )

        TransactionItem.objects.create(
            transaction=cls.sale,
            device=cls.device,
            product_name_snapshot=cls.device.product.name,
            sku_snapshot=cls.device.product.sku,
            quantity=1,
            unit_price=Decimal("4000.00"),
            price_sold=Decimal("4000.00"),
            line_total=Decimal("4000.00"),
            cost_price_at_sale=cls.device.cost_price,
        )

    def setUp(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            "/api/auth/operators/select/",
            {"operator_id": self.hassan.id},
            format="json",
        )

    def test_create_and_approve_return(self):
        response = self.client.post(
            "/api/returns/create/",
            {
                "transaction_id": self.sale.id,
                "transaction_item_id": self.sale.items.first().id,
                "quantity": 1,
                "reason": "Customer didn't like it",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], Return.Status.REQUESTED)
        return_id = response.data["id"]

        response = self.client.post(f"/api/returns/{return_id}/approve/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Return.Status.APPROVED)

    def test_unauthenticated_cannot_create_return(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/returns/create/",
            {
                "transaction_id": self.sale.id,
                "transaction_item_id": self.sale.items.first().id,
                "quantity": 1,
                "reason": "Customer didn't like it",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
