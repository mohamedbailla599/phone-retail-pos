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
        RESERVATION_COMPLETED = "RESERVATION_COMPLETED", "Reservation Completed"

        WARRANTY_APPROVED = "WARRANTY_APPROVED", "Warranty Approved"
        WARRANTY_REJECTED = "WARRANTY_REJECTED", "Warranty Rejected"

        SALE_CREATED = "SALE_CREATED", "Sale Created"
        SALE_COMPLETED = "SALE_COMPLETED", "Sale Completed"
        SALE_CANCELLED = "SALE_CANCELLED", "Sale Cancelled"

        EXCHANGE_CREATED = "EXCHANGE_CREATED", "Exchange Created"
        EXCHANGE_APPROVED = "EXCHANGE_APPROVED", "Exchange Approved"
        EXCHANGE_REJECTED = "EXCHANGE_REJECTED", "Exchange Rejected"
        EXCHANGE_COMPLETED = "EXCHANGE_COMPLETED", "Exchange Completed"

        RETURN_CREATED = "RETURN_CREATED", "Return Created"
        RETURN_APPROVED = "RETURN_APPROVED", "Return Approved"
        RETURN_REJECTED = "RETURN_REJECTED", "Return Rejected"
        RETURN_COMPLETED = "RETURN_COMPLETED", "Return Completed"

        REFUND_CREATED = "REFUND_CREATED", "Refund Created"
        REFUND_COMPLETED = "REFUND_COMPLETED", "Refund Completed"

        STOCK_ADJUSTED = "STOCK_ADJUSTED", "Stock Adjusted"

        DEVICE_STATUS_CHANGED = (
            "DEVICE_STATUS_CHANGED",
            "Device Status Changed",
        )

        USER_CREATED = "USER_CREATED", "User Created"
        USER_UPDATED = "USER_UPDATED", "User Updated"
        USER_DEACTIVATED = "USER_DEACTIVATED", "User Deactivated"

        CUSTOMER_CREATED = "CUSTOMER_CREATED", "Customer Created"
        CUSTOMER_DEBT_PAYMENT = "CUSTOMER_DEBT_PAYMENT", "Customer Debt Payment"

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