from django.db import models


class AuditLog(models.Model):
    class Action(models.TextChoices):
        PRICE_OVERRIDE = "PRICE_OVERRIDE", "Price Override"

        PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED", "Payment Confirmed"
        PAYMENT_REJECTED = "PAYMENT_REJECTED", "Payment Rejected"

        RESERVATION_CREATED = "RESERVATION_CREATED", "Reservation Created"
        RESERVATION_CANCELLED = "RESERVATION_CANCELLED", "Reservation Cancelled"
        RESERVATION_EXPIRED = "RESERVATION_EXPIRED", "Reservation Expired"
        RESERVATION_PRICE_CHANGED = (
            "RESERVATION_PRICE_CHANGED",
            "Reservation Price Changed",
        )

        WARRANTY_APPROVED = "WARRANTY_APPROVED", "Warranty Approved"
        WARRANTY_REJECTED = "WARRANTY_REJECTED", "Warranty Rejected"

        RETURN_APPROVED = "RETURN_APPROVED", "Return Approved"
        RETURN_REJECTED = "RETURN_REJECTED", "Return Rejected"

        EXCHANGE_APPROVED = "EXCHANGE_APPROVED", "Exchange Approved"
        EXCHANGE_REJECTED = "EXCHANGE_REJECTED", "Exchange Rejected"

        STOCK_ADJUSTED = "STOCK_ADJUSTED", "Stock Adjusted"

        DEVICE_STATUS_CHANGED = (
            "DEVICE_STATUS_CHANGED",
            "Device Status Changed",
        )

        USER_CREATED = "USER_CREATED", "User Created"
        USER_UPDATED = "USER_UPDATED", "User Updated"
        USER_DEACTIVATED = "USER_DEACTIVATED", "User Deactivated"

        SETTINGS_CHANGED = "SETTINGS_CHANGED", "Settings Changed"

    actor = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="audit_logs",
    )

    action = models.CharField(
        max_length=50,
        choices=Action.choices,
    )

    entity_type = models.CharField(
        max_length=100,
    )

    entity_id = models.BigIntegerField()

    old_values = models.JSONField(
        null=True,
        blank=True,
    )

    new_values = models.JSONField(
        null=True,
        blank=True,
    )

    reason = models.TextField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at", "-id"]

        indexes = [
            models.Index(
                fields=["actor", "created_at"],
            ),
            models.Index(
                fields=["action", "created_at"],
            ),
            models.Index(
                fields=["entity_type", "entity_id"],
            ),
            models.Index(
                fields=["created_at"],
            ),
        ]

    def __str__(self):
        return (
            f"{self.action} — "
            f"{self.entity_type}#{self.entity_id} — "
            f"{self.actor_id}"
        )