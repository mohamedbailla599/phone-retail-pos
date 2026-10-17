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
            # Under autoreload, only start in worker process (RUN_MAIN == 'true')
            # If not using reloader (--noreload), start directly
            run_main = os.environ.get("RUN_MAIN")
            if run_main == "true" or "--noreload" in sys.argv or run_main is None:
                try:
                    from apps.notifications.scheduler import start_scheduler
                    start_scheduler()
                except Exception as e:
                    print(f"[SCHEDULER] Error starting scheduler: {e}")
