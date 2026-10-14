from django.urls import path
from .views import AuditLogListView, AuditLogStatsView

app_name = "audit"

urlpatterns = [
    path("", AuditLogListView.as_view(), name="audit-log-list"),
    path("stats/", AuditLogStatsView.as_view(), name="audit-log-stats"),
]
