from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient
from apps.users.models import User
from apps.catalog.models import Product, Category
from apps.inventory.models import DeviceItem, AccessoryStock, StockMovement
from apps.audit.models import AuditLog
from apps.users.services.operator_context import create_operator_context

class InventoryAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testowner", password="password", is_pos_operator=True, role=User.Role.OWNER
        )
        self.client.force_authenticate(user=self.user)
        
        # Set operator context using API
        response = self.client.post(reverse('pos-operator-select'), {'operator_id': self.user.id})
        token = response.data.get('token')
        self.client.credentials(HTTP_X_OPERATOR_CONTEXT=token)
        
        self.category_dev = Category.objects.create(name="Phones", is_device=True)
        self.category_acc = Category.objects.create(name="Accessories", is_device=False)
        self.product_dev = Product.objects.create(category=self.category_dev, sku="DEV1", name="Dev", brand="Apple")
        self.product_acc = Product.objects.create(category=self.category_acc, sku="ACC1", name="Acc", brand="Apple")
        self.acc_stock = AccessoryStock.objects.create(product=self.product_acc, quantity=10, cost_price=5, selling_price=10)

    def test_receive_device_success(self):
        url = reverse('receive-device')
        data = {
            "product_id": self.product_dev.id,
            "imei_1": "123456789012345",
            "cost_price": "500.00",
            "default_selling_price": "600.00",
            "minimum_selling_price": "550.00"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(DeviceItem.objects.count(), 1)
        device = DeviceItem.objects.first()
        self.assertEqual(device.status, DeviceItem.Status.IN_STOCK)
        self.assertEqual(StockMovement.objects.count(), 1)
        self.assertEqual(AuditLog.objects.count(), 1)

    def test_receive_device_missing_identifiers(self):
        url = reverse('receive-device')
        data = {
            "product_id": self.product_dev.id,
            "cost_price": "500.00",
            "default_selling_price": "600.00",
            "minimum_selling_price": "550.00"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("at least one of IMEI1 or serial number", str(response.data))

    def test_receive_device_invalid_price(self):
        url = reverse('receive-device')
        data = {
            "product_id": self.product_dev.id,
            "imei_1": "123456789012345",
            "cost_price": "500.00",
            "default_selling_price": "600.00",
            "minimum_selling_price": "650.00"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Minimum selling price cannot exceed", str(response.data))

    def test_receive_accessory_success(self):
        url = reverse('receive-accessory')
        data = {
            "accessory_stock_id": self.acc_stock.id,
            "quantity": 5
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        self.acc_stock.refresh_from_db()
        self.assertEqual(self.acc_stock.quantity, 15)
        self.assertEqual(StockMovement.objects.count(), 1)
        self.assertEqual(AuditLog.objects.count(), 1)

    def test_receive_accessory_invalid_quantity(self):
        url = reverse('receive-accessory')
        data = {
            "accessory_stock_id": self.acc_stock.id,
            "quantity": 0
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)

    def test_adjust_accessory_success_positive(self):
        url = reverse('adjust-accessory')
        data = {
            "accessory_stock_id": self.acc_stock.id,
            "quantity_delta": 5,
            "reason": "Found extra inventory"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        self.acc_stock.refresh_from_db()
        self.assertEqual(self.acc_stock.quantity, 15)
        
        movement = StockMovement.objects.get(accessory_stock=self.acc_stock, movement_type=StockMovement.MovementType.ADJUSTMENT)
        self.assertEqual(movement.quantity, 5)
        self.assertEqual(movement.reason, "Found extra inventory")
        self.assertEqual(movement.created_by, self.user)
        
        audit = AuditLog.objects.filter(action=AuditLog.Action.STOCK_ADJUSTED).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.actor, self.user)
        self.assertEqual(str(audit.entity_id), str(self.acc_stock.id))

    def test_adjust_accessory_success_negative(self):
        url = reverse('adjust-accessory')
        data = {
            "accessory_stock_id": self.acc_stock.id,
            "quantity_delta": -3,
            "reason": "Missing items"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        self.acc_stock.refresh_from_db()
        self.assertEqual(self.acc_stock.quantity, 7)
        
        movement = StockMovement.objects.get(accessory_stock=self.acc_stock, movement_type=StockMovement.MovementType.ADJUSTMENT)
        self.assertEqual(movement.quantity, -3)

    def test_adjust_accessory_negative_stock(self):
        url = reverse('adjust-accessory')
        data = {
            "accessory_stock_id": self.acc_stock.id,
            "quantity_delta": -15, # current is 10
            "reason": "Trying to break it"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Stock cannot become negative", str(response.data))
        
        self.acc_stock.refresh_from_db()
        self.assertEqual(self.acc_stock.quantity, 10)
        
        self.assertEqual(StockMovement.objects.filter(movement_type=StockMovement.MovementType.ADJUSTMENT).count(), 0)
        self.assertEqual(AuditLog.objects.filter(action=AuditLog.Action.STOCK_ADJUSTED).count(), 0)

    def test_adjust_accessory_zero_delta(self):
        url = reverse('adjust-accessory')
        data = {
            "accessory_stock_id": self.acc_stock.id,
            "quantity_delta": 0,
            "reason": "Zero change"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("must not be 0", str(response.data))

    def test_adjust_accessory_missing_reason(self):
        url = reverse('adjust-accessory')
        data = {
            "accessory_stock_id": self.acc_stock.id,
            "quantity_delta": 2,
            "reason": ""
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)

    def test_device_listing(self):
        DeviceItem.objects.create(
            product=self.product_dev, cost_price=100, default_selling_price=150, minimum_selling_price=120, imei_1="111", received_at=timezone.now()
        )
        url = reverse('device-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_device_listing_filters(self):
        prod_apple = Product.objects.create(category=self.category_dev, sku="APL1", name="iPhone 13", brand="Apple", platform="APPLE")
        prod_android = Product.objects.create(category=self.category_dev, sku="AND1", name="Galaxy S21", brand="Samsung", platform="ANDROID")
        
        dev_apple_a = DeviceItem.objects.create(product=prod_apple, condition="A", status="IN_STOCK", cost_price=1, default_selling_price=2, minimum_selling_price=1, imei_1="123456", imei_2="789012", serial_number="SNAA", received_at=timezone.now())
        dev_apple_b = DeviceItem.objects.create(product=prod_apple, condition="B", status="SOLD", cost_price=1, default_selling_price=2, minimum_selling_price=1, imei_1="999999", serial_number="SNAB", received_at=timezone.now())
        dev_android_a = DeviceItem.objects.create(product=prod_android, condition="A", status="IN_STOCK", cost_price=1, default_selling_price=2, minimum_selling_price=1, imei_1="111111", serial_number="SNAZ", received_at=timezone.now())
        
        url = reverse('device-list')
        
        # Test Search
        res = self.client.get(url, {'search': 'iPhone'})
        self.assertEqual(len(res.data), 2)
        
        res = self.client.get(url, {'search': 'APL'}) # SKU
        self.assertEqual(len(res.data), 2)
        
        res = self.client.get(url, {'search': '789012'}) # IMEI 2
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], dev_apple_a.id)
        
        res = self.client.get(url, {'search': 'SNA'}) # Partial serial
        self.assertEqual(len(res.data), 3)

        # Test Platform
        res = self.client.get(url, {'platform': 'APPLE'})
        self.assertEqual(len(res.data), 2)
        
        # Test Condition
        res = self.client.get(url, {'condition': 'B'})
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], dev_apple_b.id)
        
        # Test combined (Apple + In Stock + A)
        res = self.client.get(url, {'platform': 'APPLE', 'status': 'IN_STOCK', 'condition': 'A'})
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], dev_apple_a.id)

        # ALL platform / condition
        res = self.client.get(url, {'platform': '', 'condition': ''})
        # self.product_dev adds 1, plus the 3 above = 4 total devices in DB but self.product_dev wasn't created in this method, let's just count total DeviceItem.objects.count()
        self.assertEqual(len(res.data), DeviceItem.objects.count())

    def test_accessory_listing(self):
        url = reverse('accessory-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_no_operator_selected(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        url = reverse('receive-accessory')
        data = {
            "accessory_stock_id": self.acc_stock.id,
            "quantity": 5
        }
        response = client.post(url, data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Operator selection is required", str(response.data))

    def _create_test_device(self, status):
        import uuid
        return DeviceItem.objects.create(
            product=self.product_dev,
            cost_price=100,
            default_selling_price=150,
            minimum_selling_price=120,
            status=status,
            serial_number=str(uuid.uuid4()),
            received_at=timezone.now()
        )

    def test_device_status_change_in_stock_to_damaged(self):
        device = self._create_test_device("IN_STOCK")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "DAMAGED",
            "reason": "Screen broken"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        device.refresh_from_db()
        self.assertEqual(device.status, "DAMAGED")
        
        movements = StockMovement.objects.filter(device=device)
        self.assertEqual(movements.count(), 1)
        self.assertEqual(movements.first().movement_type, StockMovement.MovementType.DAMAGED)
        
        audits = AuditLog.objects.filter(entity_id=str(device.id))
        self.assertTrue(audits.exists())

    def test_device_status_change_in_stock_to_lost(self):
        device = self._create_test_device("IN_STOCK")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "LOST",
            "reason": "Missing"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        device.refresh_from_db()
        self.assertEqual(device.status, "LOST")

    def test_device_status_change_reserved_to_in_stock(self):
        device = self._create_test_device("RESERVED")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "IN_STOCK",
            "reason": "Customer cancelled"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        device.refresh_from_db()
        self.assertEqual(device.status, "IN_STOCK")

    def test_device_status_change_sold_to_repair(self):
        device = self._create_test_device("SOLD")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "REPAIR",
            "reason": "Warranty"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        device.refresh_from_db()
        self.assertEqual(device.status, "REPAIR")

    def test_device_status_change_sold_to_in_stock(self):
        device = self._create_test_device("SOLD")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "IN_STOCK",
            "reason": "Returned"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        device.refresh_from_db()
        self.assertEqual(device.status, "IN_STOCK")

    def test_device_status_change_repair_to_in_stock(self):
        device = self._create_test_device("REPAIR")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "IN_STOCK",
            "reason": "Fixed"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        device.refresh_from_db()
        self.assertEqual(device.status, "IN_STOCK")

    def test_device_status_change_in_stock_to_reserved(self):
        device = self._create_test_device("IN_STOCK")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "RESERVED",
            "reason": "Reserving"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        device.refresh_from_db()
        self.assertEqual(device.status, "RESERVED")

    def test_device_status_change_in_stock_to_sold(self):
        device = self._create_test_device("IN_STOCK")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "SOLD",
            "reason": "Selling manual"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 200)
        device.refresh_from_db()
        self.assertEqual(device.status, "SOLD")

    def test_device_status_change_invalid_damaged_to_in_stock(self):
        device = self._create_test_device("DAMAGED")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "IN_STOCK",
            "reason": "Fixed it"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
        device.refresh_from_db()
        self.assertEqual(device.status, "DAMAGED")

    def test_device_status_change_invalid_lost_to_in_stock(self):
        device = self._create_test_device("LOST")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "IN_STOCK",
            "reason": "Found it"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
        device.refresh_from_db()
        self.assertEqual(device.status, "LOST")

    def test_device_status_change_missing_reason(self):
        device = self._create_test_device("IN_STOCK")
        url = reverse('device-status-change')
        data = {
            "device_id": device.id,
            "target_status": "DAMAGED",
            "reason": ""
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)

    def test_device_status_change_nonexistent(self):
        url = reverse('device-status-change')
        data = {
            "device_id": 99999,
            "target_status": "DAMAGED",
            "reason": "Fake"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
