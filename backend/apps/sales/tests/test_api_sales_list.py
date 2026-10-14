from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.sales.models import Transaction
from apps.customers.models import Customer
from decimal import Decimal

User = get_user_model()

class SaleListAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password123")
        self.customer = Customer.objects.create(
            phone_number="0611111111",
            full_name="Sale Customer",
            total_spent=Decimal("500.00")
        )
        self.customer2 = Customer.objects.create(
            phone_number="0622222222",
            full_name="Other Customer",
            total_spent=Decimal("0.00")
        )
        
        # Create some transactions
        self.t1 = Transaction.objects.create(
            receipt_id="REC-1",
            customer=self.customer,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.COMPLETED,
            created_by=self.user
        )
        self.t2 = Transaction.objects.create(
            receipt_id="REC-2",
            customer=self.customer,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.DRAFT,
            created_by=self.user
        )
        self.t3 = Transaction.objects.create(
            receipt_id="REC-3",
            customer=self.customer2,
            transaction_type=Transaction.TransactionType.SALE,
            status=Transaction.Status.COMPLETED,
            created_by=self.user
        )
        self.t4 = Transaction.objects.create(
            receipt_id="REC-4",
            customer=self.customer,
            transaction_type=Transaction.TransactionType.RESERVATION,
            status=Transaction.Status.COMPLETED,
            created_by=self.user
        )
        self.t5 = Transaction.objects.create(
            receipt_id="REC-5",
            customer=self.customer,
            transaction_type=Transaction.TransactionType.EXCHANGE,
            status=Transaction.Status.COMPLETED,
            created_by=self.user
        )

        self.url = reverse("sales:sale-create")

    def test_authentication_required(self):
        response = self.client.get(self.url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_list_all(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)

    def test_filter_by_customer(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {"customer_id": self.customer.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)
        for t in response.data:
            self.assertEqual(t["customer_id"], self.customer.id)

    def test_filter_by_status(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {"status": Transaction.Status.COMPLETED})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)
        for t in response.data:
            self.assertEqual(t["status"], Transaction.Status.COMPLETED)

    def test_filter_by_customer_and_status(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {
            "customer_id": self.customer.id, 
            "status": Transaction.Status.COMPLETED
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

    def test_filter_by_transaction_type_sale(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {"transaction_type": Transaction.TransactionType.SALE})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        for t in response.data:
            self.assertEqual(t["transaction_type"], Transaction.TransactionType.SALE)
            
    def test_filter_by_transaction_type_exchange(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {"transaction_type": Transaction.TransactionType.EXCHANGE})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["receipt_id"], "REC-5")
        
    def test_filter_by_transaction_type_reservation(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {"transaction_type": Transaction.TransactionType.RESERVATION})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["receipt_id"], "REC-4")

    def test_compound_filter_sale_completed_customer(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {
            "customer_id": self.customer.id, 
            "status": Transaction.Status.COMPLETED,
            "transaction_type": Transaction.TransactionType.SALE
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        
        # Verify response shape and exact match
        t = response.data[0]
        self.assertEqual(t["receipt_id"], "REC-1")
        self.assertEqual(t["transaction_type"], Transaction.TransactionType.SALE)
        self.assertEqual(t["status"], Transaction.Status.COMPLETED)
        
    def test_invalid_transaction_type(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {"transaction_type": "INVALID_TYPE"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
