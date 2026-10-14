from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.customers.models import Customer
from apps.refunds.models import Refund
from apps.users.models import User
from apps.sales.models import Transaction


class RefundAPITestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            username="refund_api_admin",
            password="testpass123",
            role=User.Role.OWNER,
            is_pos_account=True,
        )

        cls.hassan = User.objects.create_user(
            username="refund_api_hassan",
            first_name="Hassan",
            role=User.Role.OWNER,
            is_pos_operator=True,
        )

        cls.customer = Customer.objects.create(
            phone_number="0600000099",
            full_name="API Refund Customer",
        )

        cls.sale = Transaction.objects.create(
            receipt_id="BP-API-RF-001",
            customer=cls.customer,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.COMPLETED,
            subtotal=Decimal("4000.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("4000.00"),
            created_by=cls.hassan,
        )

        from apps.payments.models import Payment
        Payment.objects.create(
            transaction=cls.sale,
            amount=Decimal("4000.00"),
            method=Payment.Method.CASH,
            status=Payment.Status.CONFIRMED,
            created_by=cls.hassan,
            confirmed_by=cls.hassan,
        )

        from apps.returns.models import Return
        cls.return_record = Return.objects.create(
            return_number="RT-0001",
            transaction=cls.sale,
            customer=cls.customer,
            status=Return.Status.RESTOCKED,
            total_amount=Decimal("4000.00"),
            created_by=cls.hassan,
        )

    def setUp(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            "/api/auth/operators/select/",
            {"operator_id": self.hassan.id},
            format="json",
        )

    def test_create_approve_and_complete_refund(self):
        response = self.client.post(
            "/api/refunds/create/",
            {
                "customer_id": self.customer.id,
                "source_type": Refund.SourceType.RETURN,
                "source_id": self.return_record.id,
                "amount": "4000.00",
                "method": Refund.Method.CASH,
                "reason": "Test Refund",
            },
            format="json",
        )

        if response.status_code != status.HTTP_201_CREATED:
            print("ERROR", response.data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], Refund.Status.REQUESTED)
        refund_id = response.data["id"]

        response = self.client.post(f"/api/refunds/{refund_id}/approve/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Refund.Status.APPROVED)

        response = self.client.post(f"/api/refunds/{refund_id}/complete/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Refund.Status.COMPLETED)

    def test_unauthenticated_cannot_create_refund(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/refunds/create/",
            {
                "customer_id": self.customer.id,
                "source_type": Refund.SourceType.RETURN,
                "source_id": self.return_record.id,
                "amount": "4000.00",
                "method": Refund.Method.CASH,
                "reason": "Test Refund",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
