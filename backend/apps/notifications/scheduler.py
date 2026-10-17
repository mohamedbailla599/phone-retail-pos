import logging
import threading
import time
from django.utils import timezone

logger = logging.getLogger(__name__)

_scheduler_started = False
_last_sent_date = None
_last_target_time = None


def _daily_digest_worker():
    global _last_sent_date, _last_target_time
    print("[SCHEDULER] Daily digest background worker thread is ACTIVE.")

    while True:
        try:
            now = timezone.localtime()
            current_time = now.strftime("%H:%M")
            today = now.date()

            from apps.store_settings.models import StoreSettings
            settings_obj = StoreSettings.objects.first()

            target_time = "23:00"
            if settings_obj and hasattr(settings_obj, "daily_digest_time") and settings_obj.daily_digest_time:
                target_time = settings_obj.daily_digest_time.strip()

            # If the scheduled time was altered, reset the lock so the new time takes effect today
            if _last_target_time is not None and target_time != _last_target_time:
                print(f"[SCHEDULER] Daily digest target time updated from {_last_target_time} to {target_time}. Resetting daily lock.")
                _last_sent_date = None
            _last_target_time = target_time

            # Trigger once per day at or after target_time
            if current_time >= target_time and _last_sent_date != today:
                if settings_obj and hasattr(settings_obj, "daily_digest_enabled") and not settings_obj.daily_digest_enabled:
                    print(f"[SCHEDULER] Daily digest is disabled in settings. Skipping {target_time} trigger for {today}.")
                    _last_sent_date = today
                else:
                    print(f"[SCHEDULER] Local time is {current_time} — triggering automated daily digest ({target_time}) for {today}...")
                    from apps.notifications.digest import send_daily_digest

                    result = send_daily_digest(target_date=today)
                    print(f"[SCHEDULER] Automated daily digest result: {result.get('status')}")
                    _last_sent_date = today

        except Exception as exc:
            print(f"[SCHEDULER] Error in worker loop: {exc}")

        # Sleep 20 seconds between time evaluations for responsive triggers
        time.sleep(20)


def start_scheduler():
    global _scheduler_started
    if _scheduler_started:
        return
    _scheduler_started = True
    print("[SCHEDULER] Starting DailyDigestSchedulerWorker thread...")
    thread = threading.Thread(
        target=_daily_digest_worker,
        daemon=True,
        name="DailyDigestSchedulerWorker",
    )
    thread.start()
