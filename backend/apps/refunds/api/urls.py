from django.urls import path
from .views import (
    RefundListView,
    RefundDetailView,
    RefundCreateView,
    RefundApproveView,
    RefundCompleteView,
    RefundRejectView,
)

urlpatterns = [
    path("", RefundListView.as_view(), name="refund-list"),
    path("create/", RefundCreateView.as_view(), name="refund-create"),
    path("<int:refund_id>/", RefundDetailView.as_view(), name="refund-detail"),
    path("<int:refund_id>/approve/", RefundApproveView.as_view(), name="refund-approve"),
    path("<int:refund_id>/complete/", RefundCompleteView.as_view(), name="refund-complete"),
    path("<int:refund_id>/reject/", RefundRejectView.as_view(), name="refund-reject"),
]
