from django.db import models


class Category(models.Model):
    name = models.CharField(
        max_length=100,
        unique=True,
    )
    is_device = models.BooleanField(
        default=False,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Category"
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    class Platform(models.TextChoices):
        APPLE = "APPLE", "Apple"
        ANDROID = "ANDROID", "Android"
        OTHER = "OTHER", "Other"

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    sku = models.CharField(
        max_length=100,
        unique=True,
    )
    name = models.CharField(
        max_length=200,
    )
    brand = models.CharField(
        max_length=100,
    )
    platform = models.CharField(
        max_length=20,
        choices=Platform.choices,
        default=Platform.OTHER,
    )
    storage_gb = models.PositiveIntegerField(
        null=True,
        blank=True,
    )
    ram_gb = models.PositiveIntegerField(
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(
        default=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["brand", "name"]
        indexes = [
            models.Index(fields=["category", "is_active"]),
            models.Index(fields=["brand", "name"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.brand} {self.name} ({self.sku})"