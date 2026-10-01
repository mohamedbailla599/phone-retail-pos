from django.core.validators import MinValueValidator
from django.db import models


class StoreSettings(models.Model):
    store_name = models.CharField(
        max_length=150,
    )

    currency = models.CharField(
        max_length=3,
        default="MAD",
    )

    default_device_warranty_months = models.PositiveSmallIntegerField(
        default=1,
        validators=[
            MinValueValidator(0),
        ],
    )

    default_reservation_months = models.PositiveSmallIntegerField(
        default=1,
        validators=[
            MinValueValidator(1),
        ],
    )

    default_accessory_warranty_months = models.PositiveSmallIntegerField(
        default=0,
        validators=[
            MinValueValidator(0),
        ],
    )

    receipt_prefix = models.CharField(
        max_length=10,
        default="BP",
    )

    updated_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="store_settings_updates",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "Store Settings"
        verbose_name_plural = "Store Settings"

    def __str__(self):
        return self.store_name