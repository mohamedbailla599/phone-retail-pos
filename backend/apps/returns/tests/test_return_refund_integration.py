from apps.inventory.models import DeviceItem, StockMovement
from apps.returns.models import Return
from apps.returns.services.returns import (
    approve_return,
    create_return,
    process_device_return,
)
from apps.refunds.models import Refund
from apps.refunds.services.refunds import (
    approve_refund,
    complete_refund,
    create_refund,
)

from .base import ReturnTestCase


class ReturnRefundIntegrationTest(ReturnTestCase):
    def test_return_and_refund_lifecycle(self):
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

        refund = create_refund(
            customer=self.customer,
            source_type=Refund.SourceType.RETURN,
            source_id=return_record.id,
            amount=return_record.total_amount,
            method=Refund.Method.CASH,
            reason="Refund for returned device.",
            actor=self.user,
        )

        self.assertEqual(refund.status, Refund.Status.REQUESTED)
        self.assertEqual(refund.source_type, Refund.SourceType.RETURN)
        self.assertEqual(refund.source_id, return_record.id)
        self.assertEqual(refund.amount, return_record.total_amount)

        refund = approve_refund(
            refund_id=refund.id,
            actor=self.user,
        )

        refund.refresh_from_db()

        self.assertEqual(refund.status, Refund.Status.APPROVED)
        self.assertEqual(refund.approved_by_id, self.user.id)
        self.assertIsNotNone(refund.approved_at)

        refund = complete_refund(
            refund_id=refund.id,
            actor=self.user,
        )

        refund.refresh_from_db()
        return_record.refresh_from_db()

        self.assertEqual(refund.status, Refund.Status.COMPLETED)
        self.assertEqual(refund.completed_by_id, self.user.id)
        self.assertIsNotNone(refund.completed_at)

        self.assertEqual(return_record.status, Return.Status.REFUNDED)
        self.assertIsNotNone(return_record.completed_at)

        device.refresh_from_db()
        sale.refresh_from_db()
        return_record.refresh_from_db()
        refund.refresh_from_db()

        from apps.sales.models import Transaction
        self.assertEqual(sale.status, Transaction.Status.COMPLETED)
        self.assertEqual(device.status, DeviceItem.Status.IN_STOCK)
        self.assertEqual(return_record.status, Return.Status.REFUNDED)
        self.assertEqual(refund.status, Refund.Status.COMPLETED)

        with self.assertRaises(ValueError):
            create_refund(
                customer=self.customer,
                source_type=Refund.SourceType.RETURN,
                source_id=return_record.id,
                amount=return_record.total_amount,
                method=Refund.Method.CASH,
                reason="Second refund attempt.",
                actor=self.user,
            )
