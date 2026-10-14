from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class POSUserAdmin(UserAdmin):
    list_display = (
        "username",
        "first_name",
        "last_name",
        "role",
        "is_pos_account",
        "is_pos_operator",
        "is_active",
    )
    list_filter = (
        "role",
        "is_pos_account",
        "is_pos_operator",
        "is_active",
    )
    fieldsets = UserAdmin.fieldsets + (
        (
            "POS",
            {
                "fields": (
                    "role",
                    "is_pos_account",
                    "is_pos_operator",
                )
            },
        ),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "POS",
            {
                "fields": (
                    "role",
                    "is_pos_account",
                    "is_pos_operator",
                )
            },
        ),
    )
