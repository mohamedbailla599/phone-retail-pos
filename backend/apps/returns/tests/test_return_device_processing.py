from apps.inventory.models import DeviceItem, StockMovement
from apps.returns.models import Return
from apps.returns.services.returns import (
    approve_return,
    create_return,
    process_device_return,
)

from .base import ReturnTestCase


class ReturnDeviceProcessingTest(ReturnTestCase):
    def test_approve_and_process_device_return(self):
        sale, item, device = self.create_completed_sale()

        return_record = create_return(
            transaction_id=sale.id,
            transaction_item_id=item.id,
            quantity=1,
            actor=self.user,
            reason="Customer returned device.",
        )

        self.assertEqual(return_record.status, Return.Status.REQUESTED)

        return_record = approve_return(
            return_id=return_record.id,
            actor=self.user,
        )

        return_record.refresh_from_db()

        self.assertEqual(return_record.status, Return.Status.APPROVED)
        self.assertEqual(return_record.approved_by_id, self.user.id)

        return_record, processed_device = process_device_return(
            return_id=return_record.id,
            actor=self.user,
            reason="Device returned to stock.",
        )

        return_record.refresh_from_db()
        device.refresh_from_db()

        self.assertEqual(return_record.status, Return.Status.RESTOCKED)
        self.assertIsNone(return_record.completed_at)
        self.assertEqual(device.status, DeviceItem.Status.IN_STOCK)
        self.assertEqual(processed_device.id, device.id)

        movement = (
            StockMovement.objects
            .filter(
                device=device,
                movement_type=StockMovement.MovementType.RETURNED,
                reference_type="Return",
                reference_id=return_record.id,
            )
            .order_by("-id")
            .first()
        )

        self.assertIsNotNone(movement)
        self.assertEqual(movement.from_status, DeviceItem.Status.SOLD)
        self.assertEqual(movement.to_status, DeviceItem.Status.IN_STOCK)

        with self.assertRaises(ValueError):
            process_device_return(
                return_id=return_record.id,
                actor=self.user,
                reason="Second processing attempt.",
            )
