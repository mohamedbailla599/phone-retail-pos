from django.urls import path
from apps.warranty.api.views import (
    RepairTicketListCreateView,
    RepairTicketDetailView,
    RepairTicketStatusUpdateView,
    RepairTicketDeliverView,
)

app_name = "warranty"

urlpatterns = [
    path("repairs/", RepairTicketListCreateView.as_view(), name="repair-list-create"),
    path("repairs/<int:pk>/", RepairTicketDetailView.as_view(), name="repair-detail"),
    path("repairs/<int:pk>/status/", RepairTicketStatusUpdateView.as_view(), name="repair-status-update"),
    path("repairs/<int:pk>/deliver/", RepairTicketDeliverView.as_view(), name="repair-deliver"),
]
