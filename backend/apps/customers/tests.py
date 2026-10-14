from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from apps.customers.models import Customer
from decimal import Decimal

User = get_user_model()

class CustomerAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password123")
        self.customer1 = Customer.objects.create(
            phone_number="0600000001",
            full_name="John Doe",
            total_spent=Decimal("100.00")
        )
        self.customer2 = Customer.objects.create(
            phone_number="0600000002",
            full_name="Jane Smith",
            total_spent=Decimal("200.00")
        )
        self.url = reverse("customers:customer-list")

    def test_authentication_required(self):
        response = self.client.get(self.url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_customer_list(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        
        # Verify response shape
        first_item = response.data[0]
        self.assertIn("id", first_item)
        self.assertIn("full_name", first_item)
        self.assertIn("phone_number", first_item)
        self.assertIn("total_spent", first_item)
        self.assertIn("created_at", first_item)

    def test_search_by_name(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {"search": "John"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["full_name"], "John Doe")

    def test_search_by_phone(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {"search": "0600000002"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["full_name"], "Jane Smith")

    def test_search_no_match(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url, {"search": "NonExistent"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
