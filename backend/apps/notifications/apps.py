import os
import sys
from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.notifications"
    verbose_name = "Notifications"

    def ready(self):
        # Start scheduler thread when running as server
        is_server = any(arg in sys.argv for arg in ["runserver", "daphne"]) or "daphne" in sys.argv[0]
        if is_server:
            # Prevent double execution under Django's auto-reloader
            if os.environ.get("RUN_MAIN") == "true" or "daphne" in sys.argv:
                try:
                    from apps.notifications.scheduler import start_scheduler
                    start_scheduler()
                except Exception:
                    pass
