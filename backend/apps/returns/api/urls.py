from django.urls import path
from .views import (
    ReturnListView,
    ReturnDetailView,
    ReturnCreateView,
    ReturnApproveView,
    ReturnProcessDeviceView,
)

urlpatterns = [
    path("", ReturnListView.as_view(), name="return-list"),
    path("create/", ReturnCreateView.as_view(), name="return-create"),
    path("<int:return_id>/", ReturnDetailView.as_view(), name="return-detail"),
    path("<int:return_id>/approve/", ReturnApproveView.as_view(), name="return-approve"),
    path("<int:return_id>/process-device/", ReturnProcessDeviceView.as_view(), name="return-process-device"),
]
