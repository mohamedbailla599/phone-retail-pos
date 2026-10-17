import os
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.conf import settings
from apps.store_settings.models import StoreSettings


class Command(BaseCommand):
    help = "Guarantees database seeding and default admin credentials for store deployment."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force-fixture",
            action="store_true",
            help="Force reload of fixtures/initial_data.json even if users exist",
        )
        parser.add_argument(
            "--admin-user",
            default=os.environ.get("ADMIN_USERNAME", "admin"),
            help="Default admin username (default: admin)",
        )
        parser.add_argument(
            "--admin-pass",
            default=os.environ.get("ADMIN_PASSWORD", "admin"),
            help="Default admin password (default: admin)",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        force = options["force_fixture"]
        admin_username = options["admin_user"]
        admin_password = options["admin_pass"]

        fixture_path = os.path.join(settings.BASE_DIR, "fixtures", "initial_data.json")

        # 1. Check if database needs fixture loading
        user_count = User.objects.count()
        if (user_count == 0 or force) and os.path.exists(fixture_path):
            self.stdout.write(
                self.style.WARNING(
                    f"==> Empty database detected ({user_count} users). Loading initial fixture {fixture_path}..."
                )
            )
            try:
                call_command("loaddata", fixture_path, verbosity=1)
                self.stdout.write(
                    self.style.SUCCESS("==> Initial store data loaded successfully!")
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"==> Warning: Failed to load fixture: {e}")
                )

        # 2. Guarantee Default Admin Account
        admin_user, created = User.objects.get_or_create(username=admin_username)
        admin_user.first_name = "Admin"
        admin_user.last_name = "Bighrissen"
        admin_user.role = User.Role.OWNER
        admin_user.is_pos_account = True
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.is_active = True

        # Ensure admin has a usable password that matches admin_password
        if created or not admin_user.has_usable_password() or user_count == 0:
            admin_user.set_password(admin_password)
        elif not admin_user.check_password(admin_password) and options["admin_pass"] != "admin":
            # If explicitly configured via ADMIN_PASSWORD env var, update it
            admin_user.set_password(admin_password)
        elif not admin_user.check_password(admin_password) and not admin_user.has_usable_password():
            admin_user.set_password(admin_password)
        admin_user.save()

        # 3. Guarantee POS Operators (Hassan & Mohamed)
        operators = [
            ("hassan", "Hassan"),
            ("mohamed", "Mohamed"),
        ]
        for op_username, op_name in operators:
            op, op_created = User.objects.get_or_create(username=op_username)
            if op_created or not op.first_name:
                op.first_name = op_name
            op.role = User.Role.OWNER
            op.is_pos_operator = True
            op.is_active = True
            if not op.has_usable_password():
                op.set_password(admin_password)
            op.save()

        # 4. Guarantee StoreSettings exists
        StoreSettings.objects.get_or_create(
            id=1,
            defaults={
                "store_name": "Bighrissen Phone",
                "phone": "0600000000",
                "city": "Guelmim",
                "address": "Guelmim, Maroc",
                "currency": "MAD",
                "default_device_warranty_months": 3,
                "default_reservation_months": 1,
                "default_accessory_warranty_months": 1,
                "receipt_prefix": "BP",
                "updated_by": admin_user,
            },
        )

        total_users = User.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"==> Database initialization complete ({total_users} users active).\n"
                f"    [Guaranteed Admin] Username: '{admin_username}' | Password: '{admin_password}' | Superuser: True\n"
                f"    [Operators] 'hassan' (Hassan), 'mohamed' (Mohamed)"
            )
        )
