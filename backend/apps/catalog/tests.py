from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from apps.users.models import User
from apps.catalog.models import Product, Category
from apps.inventory.models import AccessoryStock

class CatalogAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testowner", password="password", is_pos_operator=True, role=User.Role.OWNER
        )
        self.client.force_authenticate(user=self.user)
        self.category = Category.objects.create(name="Accessories", is_device=False)
        self.device_category = Category.objects.create(name="Phones", is_device=True)

    def test_product_listing(self):
        Product.objects.create(category=self.category, sku="SKU1", name="Product 1", brand="Brand")
        url = reverse('product-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_product_search(self):
        Product.objects.create(category=self.category, sku="SKU1", name="Product 1", brand="Brand")
        Product.objects.create(category=self.category, sku="SKU2", name="Product 2", brand="Brand")
        url = reverse('product-list')
        response = self.client.get(url, {'name': 'Product 1'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_product_filtering(self):
        Product.objects.create(category=self.category, sku="SKU1", name="Product 1", brand="Brand")
        Product.objects.create(category=self.device_category, sku="SKU2", name="Product 2", brand="Brand")
        url = reverse('product-list')
        response = self.client.get(url, {'is_device': 'true'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['sku'], "SKU2")

    def test_product_creation_accessory_initializes_stock(self):
        url = reverse('product-list')
        data = {
            "sku": "SKU_NEW",
            "name": "New Acc",
            "brand": "Apple",
            "platform": "APPLE",
            "category_id": self.category.id
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 201)
        product = Product.objects.get(sku="SKU_NEW")
        self.assertTrue(hasattr(product, 'accessory_stock'))
        self.assertEqual(product.accessory_stock.quantity, 0)

    def test_duplicate_sku_rejection(self):
        Product.objects.create(category=self.category, sku="SKU1", name="Product 1", brand="Brand")
        url = reverse('product-list')
        data = {
            "sku": "SKU1",
            "name": "New Acc",
            "brand": "Apple",
            "category_id": self.category.id
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)

    def test_invalid_product_data(self):
        url = reverse('product-list')
        data = {
            "name": "New Acc",
            "category_id": self.category.id
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)  # Missing sku and brand
