from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class Customer(models.Model):
    phone_number = models.CharField(
        max_length=16,
        unique=True,
    )
    full_name = models.CharField(
        max_length=150,
    )
    total_spent = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(total_spent__gte=0),
                name="customer_total_spent_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["full_name"]),
        ]

    def __str__(self):
        return f"{self.full_name} — {self.phone_number}"