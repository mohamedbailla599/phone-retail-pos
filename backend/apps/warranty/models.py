from django.db import models


class WarrantyClaim(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        REPAIR = "REPAIR", "Repair"
        SALE_CANCELLED = "SALE_CANCELLED", "Sale Cancelled"
        REJECTED = "REJECTED", "Rejected"
        RESOLVED = "RESOLVED", "Resolved"

    claim_number = models.CharField(
        max_length=30,
        unique=True,
    )

    transaction = models.ForeignKey(
        "sales.Transaction",
        on_delete=models.PROTECT,
        related_name="warranty_claims",
    )

    transaction_item = models.ForeignKey(
        "sales.TransactionItem",
        on_delete=models.PROTECT,
        related_name="warranty_claims",
    )

    device = models.ForeignKey(
        "inventory.DeviceItem",
        on_delete=models.PROTECT,
        related_name="warranty_claims",
        null=True,
        blank=True,
    )

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="warranty_claims",
    )

    opened_at = models.DateTimeField()

    problem_description = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
    )

    resolution = models.TextField(
        null=True,
        blank=True,
    )

    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    resolved_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="warranty_claims_resolved",
        null=True,
        blank=True,
    )

    owner_notes = models.TextField(
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
                fields=["transaction", "created_at"]
            ),
            models.Index(
                fields=["device", "created_at"]
            ),
        ]

    def __str__(self):
        return (
            f"{self.claim_number} — "
            f"{self.status}"
        )