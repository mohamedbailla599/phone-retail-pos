from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class Refund(models.Model):
    class SourceType(models.TextChoices):
        RETURN = "RETURN", "Return"
        EXCHANGE = "EXCHANGE", "Exchange"
        RESERVATION = "RESERVATION", "Reservation"
        OVERPAYMENT = "OVERPAYMENT", "Overpayment"
        WARRANTY = "WARRANTY", "Warranty"

    class Method(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK_TRANSFER = "BANK_TRANSFER", "Bank Transfer"

    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        COMPLETED = "COMPLETED", "Completed"

    refund_number = models.CharField(
        max_length=30,
        unique=True,
    )

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="refunds",
    )

    source_type = models.CharField(
        max_length=20,
        choices=SourceType.choices,
    )

    source_id = models.BigIntegerField()

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.01"))
        ],
    )

    method = models.CharField(
        max_length=20,
        choices=Method.choices,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
    )

    reference = models.CharField(
        max_length=150,
        null=True,
        blank=True,
    )

    reason = models.TextField()

    notes = models.TextField(
        null=True,
        blank=True,
    )

    requested_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="refunds_requested",
    )

    requested_at = models.DateTimeField()

    approved_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="refunds_approved",
        null=True,
        blank=True,
    )

    approved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    completed_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="refunds_completed",
        null=True,
        blank=True,
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    rejected_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="refunds_rejected",
        null=True,
        blank=True,
    )

    rejected_at = models.DateTimeField(
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
                fields=["source_type", "source_id"]
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="refund_amount_positive",
            ),
        ]

    def __str__(self):
        return (
            f"{self.refund_number} — "
            f"{self.amount} DH — "
            f"{self.status}"
        )


class RefundPaymentAllocation(models.Model):
    refund = models.ForeignKey(
        Refund,
        on_delete=models.PROTECT,
        related_name="payment_allocations",
    )

    payment = models.ForeignKey(
        "payments.Payment",
        on_delete=models.PROTECT,
        related_name="refund_allocations",
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.01"))
        ],
    )

    class Meta:
        ordering = ["id"]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="refund_allocation_amount_positive",
            ),
            models.UniqueConstraint(
                fields=["refund", "payment"],
                name="unique_refund_payment_allocation",
            ),
        ]

        indexes = [
            models.Index(
                fields=["refund"]
            ),
            models.Index(
                fields=["payment"]
            ),
        ]

    def __str__(self):
        return (
            f"Refund {self.refund_id} → "
            f"Payment {self.payment_id}: "
            f"{self.amount} DH"
        )