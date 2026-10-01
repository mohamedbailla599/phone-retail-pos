from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Return(models.Model):

    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        APPROVED = "APPROVED", "Approved"
        RESTOCKED = "RESTOCKED", "Restocked"
        REJECTED = "REJECTED", "Rejected"
        REFUNDED = "REFUNDED", "Refunded"

    return_number = models.CharField(
        max_length=30,
        unique=True,
    )

    transaction = models.ForeignKey(
        "sales.Transaction",
        on_delete=models.PROTECT,
        related_name="returns",
    )

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="returns",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.REQUESTED,
    )

    reason = models.TextField(
        blank=True,
    )

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_returns",
    )

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approved_returns",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.return_number


class ReturnItem(models.Model):

    return_record = models.ForeignKey(
        Return,
        on_delete=models.CASCADE,
        related_name="items",
    )

    transaction_item = models.ForeignKey(
        "sales.TransactionItem",
        on_delete=models.PROTECT,
        related_name="return_items",
    )

    quantity = models.PositiveIntegerField(
        validators=[
            MinValueValidator(1),
        ],
    )

    unit_refund_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    line_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "return_record",
                    "transaction_item",
                ],
                name="unique_return_item",
            ),
        ]

    def __str__(self):
        return (
            f"{self.return_record.return_number} - "
            f"{self.transaction_item_id}"
        )