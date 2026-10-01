from django.utils import timezone

from apps.sales.models import Transaction
from apps.sales.services.sales import create_sale

from .base import SalesTestCase


class CreateSaleTests(SalesTestCase):

    def test_create_draft_sale(self):
        sale = create_sale(
            actor=self.owner,
            notes="Test draft sale",
        )

        self.assertIsNotNone(sale)
        self.assertEqual(
            sale.transaction_type,
            Transaction.TransactionType.SALE,
        )
        self.assertEqual(
            sale.status,
            Transaction.Status.DRAFT,
        )

        self.assertEqual(sale.subtotal, 0)
        self.assertEqual(sale.discount_amount, 0)
        self.assertEqual(sale.total_amount, 0)

        self.assertIsNone(sale.customer)
        self.assertEqual(sale.created_by, self.owner)
        self.assertEqual(sale.notes, "Test draft sale")
        self.assertEqual(sale.items.count(), 0)

        expected_receipt = (
            f"BP-{timezone.localtime().year}-{sale.id:06d}"
        )

        self.assertEqual(
            sale.receipt_id,
            expected_receipt,
        )