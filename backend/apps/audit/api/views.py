from datetime import datetime, time
from django.db.models import Q, Count
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.users.models import User
from .serializers import AuditLogSerializer


class AuditLogPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 5000

    def get_paginated_response(self, data):
        return Response({
            "count": self.page.paginator.count,
            "total_pages": self.page.paginator.num_pages,
            "current_page": self.page.number,
            "page_size": self.get_page_size(self.request),
            "results": data,
        })


class AuditLogListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AuditLogSerializer
    pagination_class = AuditLogPagination

    def get_queryset(self):
        queryset = AuditLog.objects.select_related("actor").order_by("-created_at", "-id")

        params = self.request.query_params

        # 1. Search text (reason, entity_type, actor username or full name)
        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(reason__icontains=search) |
                Q(entity_type__icontains=search) |
                Q(action__icontains=search) |
                Q(actor__username__icontains=search) |
                Q(actor__first_name__icontains=search) |
                Q(actor__last_name__icontains=search)
            )

        # 2. Action filter (exact action or category prefix)
        action = params.get("action", "").strip().upper()
        if action and action != "ALL":
            if action == "SALES":
                queryset = queryset.filter(action__startswith="SALE_")
            elif action == "PAYMENTS":
                queryset = queryset.filter(Q(action__startswith="PAYMENT_") | Q(action="CUSTOMER_DEBT_PAYMENT"))
            elif action == "STOCK":
                queryset = queryset.filter(Q(action="STOCK_ADJUSTED") | Q(action="DEVICE_STATUS_CHANGED"))
            elif action == "EXCHANGES":
                queryset = queryset.filter(action__startswith="EXCHANGE_")
            elif action == "CUSTOMERS":
                queryset = queryset.filter(action__startswith="CUSTOMER_")
            elif action == "USERS":
                queryset = queryset.filter(action__startswith="USER_")
            else:
                queryset = queryset.filter(action=action)

        # 3. Actor filter
        actor_id = params.get("actor_id")
        if actor_id:
            queryset = queryset.filter(actor_id=actor_id)

        # 4. Date range
        tz = timezone.get_current_timezone()
        start_date_str = params.get("start_date")
        end_date_str = params.get("end_date")

        if start_date_str:
            try:
                s_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                s_dt = timezone.make_aware(datetime.combine(s_date, time.min), tz)
                queryset = queryset.filter(created_at__gte=s_dt)
            except ValueError:
                pass

        if end_date_str:
            try:
                e_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                e_dt = timezone.make_aware(datetime.combine(e_date, time.max), tz)
                queryset = queryset.filter(created_at__lte=e_dt)
            except ValueError:
                pass

        return queryset


class AuditLogStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tz = timezone.get_current_timezone()
        now_local = timezone.localtime(timezone.now())
        today = now_local.date()
        today_start = timezone.make_aware(datetime.combine(today, time.min), tz)

        total_logs = AuditLog.objects.count()
        today_logs = AuditLog.objects.filter(created_at__gte=today_start).count()

        sales_count = AuditLog.objects.filter(action__startswith="SALE_").count()
        payments_count = AuditLog.objects.filter(
            Q(action__startswith="PAYMENT_") | Q(action="CUSTOMER_DEBT_PAYMENT")
        ).count()
        stock_count = AuditLog.objects.filter(
            Q(action="STOCK_ADJUSTED") | Q(action="DEVICE_STATUS_CHANGED")
        ).count()
        exchanges_count = AuditLog.objects.filter(action__startswith="EXCHANGE_").count()

        # Operators with log counts
        operators = (
            User.objects.filter(audit_logs__isnull=False)
            .distinct()
            .values("id", "username", "first_name", "last_name", "role")
            .annotate(log_count=Count("audit_logs"))
            .order_by("-log_count")
        )

        formatted_operators = [
            {
                "id": op["id"],
                "name": f"{op['first_name']} {op['last_name']}".strip() or op["username"],
                "username": op["username"],
                "role": op["role"],
                "log_count": op["log_count"],
            }
            for op in operators
        ]

        # Action choices list for frontend dropdowns
        action_choices = [
            {"value": choice[0], "label": choice[1]}
            for choice in AuditLog.Action.choices
        ]

        return Response({
            "total_logs": total_logs,
            "today_logs": today_logs,
            "categories": {
                "sales": sales_count,
                "payments": payments_count,
                "stock": stock_count,
                "exchanges": exchanges_count,
            },
            "operators": formatted_operators,
            "action_choices": action_choices,
        })
