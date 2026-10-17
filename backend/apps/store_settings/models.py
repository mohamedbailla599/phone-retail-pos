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

    phone_number = models.CharField(
        max_length=50,
        blank=True,
        default="+212 600-000000",
    )

    address = models.CharField(
        max_length=255,
        blank=True,
        default="Boulevard Hassan II, Agadir",
    )

    receipt_footer_message = models.TextField(
        blank=True,
        default="Merci pour votre visite ! Les articles vendus sont garantis selon nos conditions générales de vente.",
    )

    owner_email = models.EmailField(
        blank=True,
        default="",
        help_text="Adresse email du propriétaire pour la réception du récapitulatif quotidien.",
    )

    daily_digest_enabled = models.BooleanField(
        default=True,
        help_text="Activer l'envoi automatique du récapitulatif des ventes, stock et dettes chaque soir.",
    )

    daily_digest_time = models.CharField(
        max_length=5,
        default="23:00",
        help_text="Heure programmée d'envoi automatique du bilan quotidien (format HH:MM, ex: 23:00).",
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