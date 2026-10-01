from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class DeviceItem(models.Model):
    class Condition(models.TextChoices):
        A = "A", "A"
        B = "B", "B"
        C = "C", "C"

    class Status(models.TextChoices):
        RECEIVED = "RECEIVED", "Received"
        IN_STOCK = "IN_STOCK", "In Stock"
        RESERVED = "RESERVED", "Reserved"
        SOLD = "SOLD", "Sold"
        REPAIR = "REPAIR", "Repair"
        LOST = "LOST", "Lost"
        DAMAGED = "DAMAGED", "Damaged"

    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.PROTECT,
        related_name="device_items",
    )

    imei_1 = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
    )

    imei_2 = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
    )

    serial_number = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
    )

    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    default_selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    minimum_selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    battery_health = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[
            MinValueValidator(0),
            MaxValueValidator(100),
        ],
    )

    condition = models.CharField(
        max_length=1,
        choices=Condition.choices,
        default=Condition.A,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.RECEIVED,
    )

    received_at = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-received_at"]
        indexes = [
            models.Index(fields=["product", "status"]),
            models.Index(fields=["status"]),
            models.Index(fields=["condition"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(imei_1__isnull=False)
                    | models.Q(serial_number__isnull=False)
                ),
                name="device_identifier_required",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(imei_2__isnull=True)
                    | ~models.Q(imei_2=models.F("imei_1"))
                ),
                name="imei_2_different_from_imei_1",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    minimum_selling_price__lte=models.F(
                        "default_selling_price"
                    )
                ),
                name="minimum_price_lte_default_price",
            ),
        ]

    def __str__(self):
        identifier = (
            self.imei_1
            or self.serial_number
            or str(self.pk)
        )
        return f"{self.product} — {identifier}"


class AccessoryStock(models.Model):
    product = models.OneToOneField(
        "catalog.Product",
        on_delete=models.PROTECT,
        related_name="accessory_stock",
    )

    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    quantity = models.PositiveIntegerField(
        default=0,
    )

    reorder_level = models.PositiveIntegerField(
        default=0,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["product__name"]
        indexes = [
            models.Index(fields=["quantity"]),
            models.Index(fields=["reorder_level"]),
        ]

    def __str__(self):
        return f"{self.product} — {self.quantity} units"


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        RECEIVED = "RECEIVED", "Received"
        SALE = "SALE", "Sale"
        COMPLIMENTARY = "COMPLIMENTARY", "Complimentary"
        RETURN = "RETURN", "Return"
        DAMAGE = "DAMAGE", "Damage"
        LOSS = "LOSS", "Loss"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"
        RESERVED = "RESERVED", "Reserved"
        RESERVATION_RELEASED = (
            "RESERVATION_RELEASED",
            "Reservation Released",
        )
        SOLD = "SOLD", "Sold"
        RETURNED = "RETURNED", "Returned"
        REPAIR = "REPAIR", "Repair"
        REPAIR_COMPLETED = (
            "REPAIR_COMPLETED",
            "Repair Completed",
        )
        DAMAGED = "DAMAGED", "Damaged"
        LOST = "LOST", "Lost"
        EXCHANGE_OUT = "EXCHANGE_OUT", "Exchange Out"
        EXCHANGE_IN = "EXCHANGE_IN", "Exchange In"

    device = models.ForeignKey(
        DeviceItem,
        on_delete=models.PROTECT,
        related_name="stock_movements",
        null=True,
        blank=True,
    )

    accessory_stock = models.ForeignKey(
        AccessoryStock,
        on_delete=models.PROTECT,
        related_name="stock_movements",
        null=True,
        blank=True,
    )

    movement_type = models.CharField(
        max_length=30,
        choices=MovementType.choices,
    )

    quantity = models.IntegerField()

    from_status = models.CharField(
        max_length=20,
        choices=DeviceItem.Status.choices,
        null=True,
        blank=True,
    )

    to_status = models.CharField(
        max_length=20,
        choices=DeviceItem.Status.choices,
        null=True,
        blank=True,
    )

    reference_type = models.CharField(
        max_length=50,
        null=True,
        blank=True,
    )

    reference_id = models.BigIntegerField(
        null=True,
        blank=True,
    )

    reason = models.TextField(
        null=True,
        blank=True,
    )

    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["device", "created_at"]),
            models.Index(
                fields=["accessory_stock", "created_at"]
            ),
            models.Index(
                fields=["movement_type", "created_at"]
            ),
            models.Index(
                fields=["reference_type", "reference_id"]
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(quantity__gt=0)
                    | models.Q(quantity__lt=0)
                ),
                name="stock_movement_quantity_nonzero",
            ),
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
                name="stock_movement_exactly_one_stock_target",
            ),
        ]

    def __str__(self):
        target = self.device or self.accessory_stock
        return (
            f"{self.movement_type} — "
            f"{target} — "
            f"{self.quantity}"
        )