from apps.inventory.models import DeviceItem, StockMovement
from apps.inventory.services.inventory import (
    complete_device_repair,
    mark_device_damaged,
    mark_device_lost,
    receive_device,
    return_device_to_stock,
    send_device_to_repair,
    sell_device,
)

from .base import InventoryTestCase


class InventoryLifecycleTest(InventoryTestCase):
    def setUp(self):
        super().setUp()

        self.category = self.create_category(
            name="Test Smartphones",
            is_device=True,
        )

        self.product = self.create_accessory_product(
            category=self.category,
            sku="TEST-LIFECYCLE",
            name="Lifecycle Test Phone",
        )

        self.product.platform = "ANDROID"
        self.product.storage_gb = 128
        self.product.ram_gb = 8
        self.product.save()

    def test_device_inventory_lifecycle(self):
        device1 = receive_device(
            actor=self.owner,
            product=self.product,
            imei_1="1111111111",
            imei_2="2222222222",
            serial_number="SN-REPAIR",
            cost_price="3000.00",
            default_selling_price="4000.00",
            minimum_selling_price="3500.00",
        )

        self.assertEqual(device1.status, DeviceItem.Status.IN_STOCK)

        sell_device(
            device_id=device1.id,
            actor=self.owner,
        )

        device1.refresh_from_db()
        self.assertEqual(device1.status, DeviceItem.Status.SOLD)

        send_device_to_repair(
            device_id=device1.id,
            actor=self.owner,
            reference_type="WarrantyClaim",
            reference_id=1,
            reason="Test warranty repair",
        )

        device1.refresh_from_db()
        self.assertEqual(device1.status, DeviceItem.Status.REPAIR)

        complete_device_repair(
            device_id=device1.id,
            actor=self.owner,
            reference_type="WarrantyClaim",
            reference_id=1,
            reason="Repair completed",
        )

        device1.refresh_from_db()
        self.assertEqual(device1.status, DeviceItem.Status.IN_STOCK)

        device2 = receive_device(
            actor=self.owner,
            product=self.product,
            imei_1="3333333333",
            serial_number="SN-DAMAGED",
            cost_price="2000.00",
            default_selling_price="3000.00",
            minimum_selling_price="2500.00",
        )

        mark_device_damaged(
            device_id=device2.id,
            actor=self.owner,
            reason="Test damaged device",
        )

        device2.refresh_from_db()
        self.assertEqual(device2.status, DeviceItem.Status.DAMAGED)

        device3 = receive_device(
            actor=self.owner,
            product=self.product,
            imei_1="4444444444",
            serial_number="SN-LOST",
            cost_price="1500.00",
            default_selling_price="2500.00",
            minimum_selling_price="2000.00",
        )

        mark_device_lost(
            device_id=device3.id,
            actor=self.owner,
            reason="Test lost device",
        )

        device3.refresh_from_db()
        self.assertEqual(device3.status, DeviceItem.Status.LOST)

        device4 = receive_device(
            actor=self.owner,
            product=self.product,
            imei_1="5555555555",
            serial_number="SN-RETURN",
            cost_price="2500.00",
            default_selling_price="3500.00",
            minimum_selling_price="3000.00",
        )

        sell_device(
            device_id=device4.id,
            actor=self.owner,
        )

        return_device_to_stock(
            device_id=device4.id,
            actor=self.owner,
            reference_type="Return",
            reference_id=1,
            reason="Approved return - RESTOCK",
        )

        device4.refresh_from_db()
        self.assertEqual(device4.status, DeviceItem.Status.IN_STOCK)

        movements = StockMovement.objects.filter(
            device__in=[device1, device2, device3, device4]
        ).order_by("created_at")

        self.assertGreaterEqual(movements.count(), 10)