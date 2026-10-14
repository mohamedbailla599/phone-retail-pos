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
    notes = models.TextField(
        blank=True,
        default="",
    )
    address = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )
    current_debt = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    credit_limit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
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
            models.CheckConstraint(
                condition=models.Q(current_debt__gte=0),
                name="customer_current_debt_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["full_name"]),
            models.Index(fields=["phone_number"]),
        ]

    def __str__(self):
        return f"{self.full_name} — {self.phone_number}"


class CustomerDebtPayment(models.Model):
    class Method(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK_TRANSFER = "BANK_TRANSFER", "Bank Transfer"

    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="debt_payments",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    payment_method = models.CharField(
        max_length=20,
        choices=Method.choices,
        default=Method.CASH,
    )
    notes = models.TextField(
        blank=True,
        default="",
    )
    operator = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="debt_payments_received",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="debt_payment_amount_positive",
            ),
        ]
        indexes = [
            models.Index(fields=["customer", "created_at"]),
        ]

    def __str__(self):
        return f"{self.amount} DH — {self.customer.full_name} ({self.payment_method})"