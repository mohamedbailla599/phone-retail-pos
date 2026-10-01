from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class Transaction(models.Model):
    class TransactionType(models.TextChoices):
        SALE = "SALE", "Sale"
        RESERVATION = "RESERVATION", "Reservation"
        EXCHANGE = "EXCHANGE", "Exchange"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING_PAYMENT = "PENDING_PAYMENT", "Pending Payment"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    receipt_id = models.CharField(
        max_length=30,
        unique=True,
    )

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="transactions",
        null=True,
        blank=True,
    )

    exchange = models.OneToOneField(
    "exchanges.Exchange",
    on_delete=models.PROTECT,
    null=True,
    blank=True,
    related_name="financial_transaction",
    )
    
    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    notes = models.TextField(
        null=True,
        blank=True,
    )

    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="transactions_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at", "-id"]

        indexes = [
            models.Index(
                fields=["status", "created_at"]
            ),
            models.Index(
                fields=["transaction_type", "created_at"]
            ),
            models.Index(
                fields=["customer", "created_at"]
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(subtotal__gte=0),
                name="transaction_subtotal_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(discount_amount__gte=0),
                name="transaction_discount_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(total_amount__gte=0),
                name="transaction_total_non_negative",
            ),
        ]

    def __str__(self):
        return (
            f"{self.receipt_id} — "
            f"{self.transaction_type}"
        )


class TransactionItem(models.Model):
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.PROTECT,
        related_name="items",
    )

    device = models.ForeignKey(
        "inventory.DeviceItem",
        on_delete=models.PROTECT,
        related_name="transaction_items",
        null=True,
        blank=True,
    )

    accessory_stock = models.ForeignKey(
        "inventory.AccessoryStock",
        on_delete=models.PROTECT,
        related_name="transaction_items",
        null=True,
        blank=True,
    )

    product_name_snapshot = models.CharField(
        max_length=200,
    )

    sku_snapshot = models.CharField(
        max_length=100,
    )

    quantity = models.PositiveIntegerField()

    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    price_sold = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    line_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    cost_price_at_sale = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ],
    )

    is_complimentary = models.BooleanField(
        default=False,
    )

    warranty_start = models.DateField(
        null=True,
        blank=True,
    )

    warranty_end = models.DateField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["id"]

        indexes = [
            models.Index(
                fields=["transaction", "id"]
            ),
            models.Index(
                fields=["device"]
            ),
            models.Index(
                fields=["accessory_stock"]
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        device__isnull=False,
                        accessory_stock__isnull=True,
                    )
                    | models.Q(
                        device__isnull=True,
                        accessory_stock__isnull=False,
                    )
                ),
                name="transaction_item_exactly_one_stock_target",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="transaction_item_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=0),
                name="transaction_item_unit_price_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(price_sold__gte=0),
                name="transaction_item_price_sold_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(line_total__gte=0),
                name="transaction_item_line_total_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(cost_price_at_sale__gte=0),
                name="transaction_item_cost_non_negative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(is_complimentary=False)
                    | models.Q(price_sold=0)
                ),
                name="complimentary_item_price_zero",
            ),
        ]

    def __str__(self):
        return (
            f"{self.product_name_snapshot} "
            f"× {self.quantity}"
        )