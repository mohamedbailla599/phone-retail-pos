from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        CASHIER = "CASHIER", "Cashier"
        MANAGER = "MANAGER", "Manager"
        TECHNICIAN = "TECHNICIAN", "Technician"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OWNER,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.get_full_name() or self.username