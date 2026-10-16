import logging
import threading
import time
from django.utils import timezone

logger = logging.getLogger(__name__)

_scheduler_started = False
_last_sent_date = None


def _daily_digest_worker():
    global _last_sent_date
    logger.info("Daily digest scheduler background worker started (checking for 23:00 trigger).")

    while True:
        try:
            now = timezone.localtime()
            current_time = now.strftime("%H:%M")
            today = now.date()

            # Trigger once per day at or after 23:00
            if current_time >= "23:00" and _last_sent_date != today:
                from apps.store_settings.models import StoreSettings
                settings_obj = StoreSettings.objects.first()
                if settings_obj and hasattr(settings_obj, "daily_digest_enabled") and not settings_obj.daily_digest_enabled:
                    logger.info(f"Daily digest is disabled in settings. Skipping 23:00 trigger for {today}.")
                    _last_sent_date = today
                else:
                    logger.info(f"Local time is {current_time} — triggering automated 23:00 daily digest for {today}...")
                    from apps.notifications.digest import send_daily_digest

                    result = send_daily_digest(target_date=today)
                    logger.info(f"Automated daily digest result: {result.get('status')}")
                    _last_sent_date = today

        except Exception as exc:
            logger.error(f"Error in daily digest scheduler worker: {exc}")

        # Sleep 45 seconds between time evaluations
        time.sleep(45)


def start_scheduler():
    global _scheduler_started
    if _scheduler_started:
        return
    _scheduler_started = True
    thread = threading.Thread(
        target=_daily_digest_worker,
        daemon=True,
        name="DailyDigestSchedulerWorker",
    )
    thread.start()
