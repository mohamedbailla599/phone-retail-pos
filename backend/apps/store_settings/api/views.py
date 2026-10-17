from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.store_settings.models import StoreSettings
from apps.users.services.operator_context import get_required_operator
from .serializers import StoreSettingsSerializer


class StoreSettingsDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_settings(self, user):
        settings_obj = StoreSettings.objects.first()
        if not settings_obj:
            settings_obj = StoreSettings.objects.create(
                store_name="Bighrissen Phone",
                phone_number="+212 600-000000",
                address="Boulevard Hassan II, Agadir",
                currency="MAD",
                receipt_prefix="BP",
                receipt_footer_message="Merci pour votre visite ! Les articles vendus sont garantis selon nos conditions générales de vente.",
                default_device_warranty_months=3,
                default_accessory_warranty_months=1,
                default_reservation_months=1,
                updated_by=user,
            )
        return settings_obj

    def get(self, request):
        settings_obj = self.get_settings(request.user)
        serializer = StoreSettingsSerializer(settings_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        settings_obj = self.get_settings(request.user)
        serializer = StoreSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Track changes for audit log
        tracked_fields = [
            "store_name",
            "phone_number",
            "address",
            "currency",
            "receipt_prefix",
            "receipt_footer_message",
            "default_device_warranty_months",
            "default_accessory_warranty_months",
            "default_reservation_months",
            "owner_email",
            "daily_digest_enabled",
            "daily_digest_time",
        ]
        old_values = {}
        for field in tracked_fields:
            if field in serializer.validated_data:
                old_values[field] = getattr(settings_obj, field)

        try:
            operator = get_required_operator(request)
        except Exception:
            operator = getattr(request, "user", None)

        updated_instance = serializer.save(updated_by=operator or request.user)

        new_values = {}
        for field in old_values:
            new_values[field] = getattr(updated_instance, field)

        if old_values and operator:
            try:
                AuditLog.objects.create(
                    actor=operator,
                    action=AuditLog.Action.SETTINGS_CHANGED,
                    entity_type="StoreSettings",
                    entity_id=updated_instance.id,
                    old_values=old_values,
                    new_values=new_values,
                    reason="Paramètres du magasin modifiés",
                )
            except Exception:
                pass

        return Response(StoreSettingsSerializer(updated_instance).data, status=status.HTTP_200_OK)


class DatabaseBackupDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(request.user, "role", None) != "OWNER" and not request.user.is_superuser:
            return Response(
                {"error": "Seul le propriétaire peut télécharger une sauvegarde."},
                status=status.HTTP_403_FORBIDDEN
            )

        import io
        import datetime
        from django.core.management import call_command
        from django.http import HttpResponse

        timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S")
        buffer = io.StringIO()
        call_command(
            "dumpdata",
            "--natural-foreign",
            "--natural-primary",
            "--indent", "2",
            stdout=buffer
        )
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type="application/json")
        response["Content-Disposition"] = f'attachment; filename="bighrissen_pos_backup_{timestamp}.json"'
        return response
