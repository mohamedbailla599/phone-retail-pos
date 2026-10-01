from apps.inventory.models import DeviceItem
from apps.returns.models import Return
from apps.returns.services.returns import create_return

from .base import ReturnTestCase


class ReturnCreationTest(ReturnTestCase):
    def test_create_return(self):
        sale, item, device = self.create_completed_sale()

        return_record = create_return(
            transaction_id=sale.id,
            transaction_item_id=item.id,
            quantity=1,
            actor=self.user,
            reason="Customer returned device.",
        )

        return_item = return_record.items.first()

        self.assertEqual(return_record.status, Return.Status.REQUESTED)
        self.assertEqual(return_record.transaction_id, sale.id)
        self.assertEqual(return_record.customer_id, self.customer.id)

        self.assertEqual(return_item.transaction_item_id, item.id)
        self.assertEqual(return_item.quantity, 1)
        self.assertEqual(return_item.unit_refund_amount, item.price_sold)
        self.assertEqual(return_item.line_total, item.price_sold)
        self.assertEqual(return_record.total_amount, item.price_sold)

        # Inventory must not change during request creation.
        device.refresh_from_db()
        self.assertEqual(device.status, DeviceItem.Status.SOLD)
