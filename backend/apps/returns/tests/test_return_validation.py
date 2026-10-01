from uuid import uuid4

from apps.returns.services.returns import create_return

from .base import ReturnTestCase


class ReturnValidationTest(ReturnTestCase):
    def test_quantity_greater_than_sold_quantity(self):
        sale, item, _ = self.create_completed_sale()

        with self.assertRaises(ValueError):
            create_return(
                transaction_id=sale.id,
                transaction_item_id=item.id,
                quantity=2,
                actor=self.user,
                reason="Invalid quantity test",
            )

    def test_item_from_another_sale(self):
        sale_1, item_1, _ = self.create_completed_sale()

        customer_2 = self.create_customer("Another Customer")
        sale_2, item_2, _ = self.create_completed_sale(customer=customer_2)

        with self.assertRaises(ValueError):
            create_return(
                transaction_id=sale_1.id,
                transaction_item_id=item_2.id,
                quantity=1,
                actor=self.user,
                reason="Wrong transaction item test",
            )

    def test_duplicate_return(self):
        sale, item, _ = self.create_completed_sale()

        create_return(
            transaction_id=sale.id,
            transaction_item_id=item.id,
            quantity=1,
            actor=self.user,
            reason="First valid return",
        )

        with self.assertRaises(ValueError):
            create_return(
                transaction_id=sale.id,
                transaction_item_id=item.id,
                quantity=1,
                actor=self.user,
                reason="Second invalid return",
            )

    def test_non_completed_sale(self):
        device = self.create_device()
        draft_sale = self._create_draft_sale(device)

        draft_item = draft_sale.items.first()

        with self.assertRaises(ValueError):
            create_return(
                transaction_id=draft_sale.id,
                transaction_item_id=draft_item.id,
                quantity=1,
                actor=self.user,
                reason="Draft sale return test",
            )

    def _create_draft_sale(self, device):
        from apps.sales.services.sales import add_device_to_sale, create_sale

        sale = create_sale(
            actor=self.user,
            customer=self.customer,
        )

        add_device_to_sale(
            sale_id=sale.id,
            device_id=device.id,
            actor=self.user,
        )

        return sale
