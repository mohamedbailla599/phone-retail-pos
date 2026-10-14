from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = "OWNER", "Propriétaire & Admin"
        CASHIER = "CASHIER", "Caissier"

    is_pos_account = models.BooleanField(default=False)
    is_pos_operator = models.BooleanField(default=False)

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OWNER,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.get_full_name() or self.username