from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class Reservation(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        EXPIRED = "EXPIRED", "Expired"

    reservation_number = models.CharField(
        max_length=30,
        unique=True,
    )

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="reservations",
    )

    device = models.ForeignKey(
        "inventory.DeviceItem",
        on_delete=models.PROTECT,
        related_name="reservations",
    )

    transaction = models.ForeignKey(
        "sales.Transaction",
        on_delete=models.PROTECT,
        related_name="reservations",
    )

    reserved_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    reserved_at = models.DateTimeField()

    expires_at = models.DateTimeField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
    )

    notes = models.TextField(
        null=True,
        blank=True,
    )

    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    cancelled_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="reservations_cancelled",
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
        related_name="reservations_completed",
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
                fields=["status", "expires_at"]
            ),
            models.Index(
                fields=["customer", "status"]
            ),
            models.Index(
                fields=["device", "status"]
            ),
            models.Index(
                fields=["transaction"]
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(reserved_price__gte=0),
                name="reservation_price_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(expires_at__gt=models.F("reserved_at")),
                name="reservation_expiry_after_start",
            ),
            models.UniqueConstraint(
                fields=["customer"],
                condition=models.Q(status="ACTIVE"),
                name="one_active_reservation_per_customer",
            ),
            models.UniqueConstraint(
                fields=["device"],
                condition=models.Q(status="ACTIVE"),
                name="one_active_reservation_per_device",
            ),
        ]

    def __str__(self):
        return (
            f"{self.reservation_number} — "
            f"{self.status}"
        )