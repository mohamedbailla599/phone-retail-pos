from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class Exchange(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        COMPLETED = "COMPLETED", "Completed"

    class FinancialDirection(models.TextChoices):
        CUSTOMER_PAYS = "CUSTOMER_PAYS", "Customer Pays"
        STORE_REFUNDS = "STORE_REFUNDS", "Store Refunds"
        EVEN = "EVEN", "Even"

    exchange_number = models.CharField(
        max_length=30,
        unique=True,
    )

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="exchanges",
    )

    original_transaction = models.ForeignKey(
        "sales.Transaction",
        on_delete=models.PROTECT,
        related_name="exchanges",
    )

    old_device = models.ForeignKey(
        "inventory.DeviceItem",
        on_delete=models.PROTECT,
        related_name="exchanges_as_old_device",
    )

    new_device = models.ForeignKey(
        "inventory.DeviceItem",
        on_delete=models.PROTECT,
        related_name="exchanges_as_new_device",
    )

    old_device_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    new_device_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    difference_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    financial_direction = models.CharField(
        max_length=20,
        choices=FinancialDirection.choices,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
    )

    reason = models.TextField(
        null=True,
        blank=True,
    )

    owner_notes = models.TextField(
        null=True,
        blank=True,
    )

    requested_at = models.DateTimeField()

    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    reviewed_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="exchanges_reviewed",
        null=True,
        blank=True,
    )

    approved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    approved_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="exchanges_approved",
        null=True,
        blank=True,
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    completed_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="exchanges_completed",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at", "-id"]

        indexes = [
            models.Index(
                fields=["status", "created_at"]
            ),
            models.Index(
                fields=["customer", "created_at"]
            ),
            models.Index(
                fields=["original_transaction", "created_at"]
            ),
            models.Index(
                fields=["old_device"]
            ),
            models.Index(
                fields=["new_device"]
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(old_device_value__gte=0),
                name="exchange_old_value_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(new_device_price__gte=0),
                name="exchange_new_price_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(difference_amount__gte=0),
                name="exchange_difference_non_negative",
            ),
            models.CheckConstraint(
                condition=~models.Q(
                    old_device=models.F("new_device")
                ),
                name="exchange_devices_must_differ",
            ),
        ]

    def __str__(self):
        return (
            f"{self.exchange_number} — "
            f"{self.status}"
        )