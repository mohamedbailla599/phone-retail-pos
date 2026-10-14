from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Create or update the shared POS account and the two POS operator identities."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin")
        parser.add_argument("--hassan-username", default="hassan")
        parser.add_argument("--mohamed-username", default="mohamed")
        parser.add_argument("--password", default=None)

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        username = options["username"]
        password = options["password"]

        if not password:
            password = self._prompt_password()

        if not password:
            raise CommandError("A non-empty POS password is required.")

        admin_user, _ = User.objects.get_or_create(username=username)
        admin_user.first_name = "POS"
        admin_user.last_name = "Admin"
        admin_user.role = User.Role.OWNER
        admin_user.is_pos_account = True
        admin_user.is_pos_operator = False
        admin_user.is_active = True
        admin_user.set_password(password)
        admin_user.save()

        operators = (
            (options["hassan_username"], "Hassan"),
            (options["mohamed_username"], "Mohamed"),
        )

        for operator_username, name in operators:
            operator, _ = User.objects.get_or_create(username=operator_username)
            operator.first_name = name
            operator.last_name = ""
            operator.role = User.Role.OWNER
            operator.is_pos_account = False
            operator.is_pos_operator = True
            operator.is_active = True
            operator.set_unusable_password()
            operator.save()

        from apps.store_settings.models import StoreSettings
        StoreSettings.objects.get_or_create(
            id=1,
            defaults={
                "store_name": "Bighrissen Phone",
                "currency": "MAD",
                "default_device_warranty_months": 3,
                "default_reservation_months": 1,
                "default_accessory_warranty_months": 1,
                "receipt_prefix": "BP",
                "updated_by": admin_user,
            },
        )

        self.stdout.write(self.style.SUCCESS("Bighrissen Phone POS accounts are ready."))
        self.stdout.write(f"Shared POS username: {username}")
        self.stdout.write(
            "Operators: "
            f"{options['hassan_username']} (Hassan), "
            f"{options['mohamed_username']} (Mohamed)"
        )

    def _prompt_password(self):
        from getpass import getpass

        first = getpass("POS password: ")
        second = getpass("Confirm POS password: ")
        if first != second:
            raise CommandError("The passwords do not match.")
        return first
