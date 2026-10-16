from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer
from apps.notifications.services import NotificationScanner


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        category = request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category.upper())

        is_read_param = request.query_params.get("is_read")
        if is_read_param is not None:
            is_read_bool = is_read_param.lower() in ["true", "1"]
            queryset = queryset.filter(is_read=is_read_bool)

        # Limit recent notifications to avoid overload (up to 100)
        recent_notifications = queryset[:100]
        serializer = self.get_serializer(recent_notifications, many=True)

        unread_count = Notification.objects.filter(is_read=False).count()
        by_category = {
            "STOCK": Notification.objects.filter(is_read=False, category=Notification.Category.STOCK).count(),
            "DEBT": Notification.objects.filter(is_read=False, category=Notification.Category.DEBT).count(),
            "RESERVATION": Notification.objects.filter(is_read=False, category=Notification.Category.RESERVATION).count(),
            "SYSTEM": Notification.objects.filter(is_read=False, category=Notification.Category.SYSTEM).count(),
        }

        return Response(
            {
                "unread_count": unread_count,
                "by_category": by_category,
                "results": serializer.data,
            }
        )

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        now = timezone.now()
        updated = Notification.objects.filter(is_read=False).update(
            is_read=True,
            read_at=now,
        )
        return Response({"marked_read_count": updated, "status": "success"})

    @action(detail=False, methods=["post", "delete"], url_path="clear-all")
    def clear_all(self, request):
        category = request.query_params.get("category")
        qs = Notification.objects.all()
        if category and category.upper() != "ALL":
            qs = qs.filter(category=category.upper())
        deleted_count, _ = qs.delete()
        return Response({"deleted_count": deleted_count, "status": "success"})

    @action(detail=False, methods=["post"], url_path="scan")
    def trigger_scan(self, request):
        scan_results = NotificationScanner.scan_all()
        unread_count = Notification.objects.filter(is_read=False).count()
        return Response(
            {
                "scan_results": scan_results,
                "unread_count": unread_count,
                "status": "success",
            }
        )

    @action(detail=False, methods=["post"], url_path="send-digest")
    def send_digest(self, request):
        from apps.notifications.digest import send_daily_digest, get_daily_digest_data
        email = request.data.get("email")
        preview_only = request.data.get("preview_only", False)

        if preview_only:
            digest_data = get_daily_digest_data()
            return Response({"status": "success", "preview": digest_data})

        result = send_daily_digest(recipient_email=email, force=True)
        return Response(result)
