from django.core.management.base import BaseCommand
from apps.notifications.digest import send_daily_digest


class Command(BaseCommand):
    help = "Generates and sends the daily 23:00 store digest email to owners."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            default=None,
            help="Recipient email address override",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force sending even if already sent today",
        )

    def handle(self, *args, **options):
        email = options.get("email")
        force = options.get("force", False)

        self.stdout.write(self.style.NOTICE("Generating daily 23:00 store digest..."))
        result = send_daily_digest(recipient_email=email, force=force)

        if result.get("status") == "success":
            self.stdout.write(
                self.style.SUCCESS(
                    f"[OK] Daily digest sent successfully to {result.get('recipient')}!"
                )
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    f"[ERROR] Failed to send daily digest: {result.get('error')}"
                )
            )
