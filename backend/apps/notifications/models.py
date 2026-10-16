from django.db import models


class Notification(models.Model):
    class Category(models.TextChoices):
        STOCK = "STOCK", "Stock"
        DEBT = "DEBT", "Dette Client"
        RESERVATION = "RESERVATION", "Réservation"
        SYSTEM = "SYSTEM", "Système"

    class Severity(models.TextChoices):
        CRITICAL = "CRITICAL", "Critique"
        WARNING = "WARNING", "Avertissement"
        INFO = "INFO", "Information"

    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.SYSTEM,
    )
    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.INFO,
    )
    title = models.CharField(
        max_length=255,
    )
    message = models.TextField()

    reference_type = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Type of related entity (e.g. PRODUCT, ACCESSORY, RESERVATION, CUSTOMER)",
    )
    reference_id = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="ID or identifier of the related entity",
    )
    action_url = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Client-side routing path for quick navigation",
    )

    is_read = models.BooleanField(
        default=False,
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_read", "-created_at"]),
            models.Index(fields=["category", "is_read"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]

    def __str__(self):
        status = "Lu" if self.is_read else "Non lu"
        return f"[{self.category}] {self.title} ({status})"
