from django.urls import path

from .views import (
    ExchangeApproveView,
    ExchangeCompleteView,
    ExchangeCreateView,
    ExchangeDetailView,
    ExchangePaymentCreateView,
    ExchangePaymentStatusView,
    ExchangeRefundCompleteView,
    ExchangeRefundCreateView,
    ExchangeRejectView,
    ExchangeSubmitView,
)


urlpatterns = [
    path(
        "",
        ExchangeCreateView.as_view(),
        name="exchange-create",
    ),
    path(
        "<int:exchange_id>/",
        ExchangeDetailView.as_view(),
        name="exchange-detail",
    ),
    path(
        "<int:exchange_id>/submit/",
        ExchangeSubmitView.as_view(),
        name="exchange-submit",
    ),
    path(
        "<int:exchange_id>/approve/",
        ExchangeApproveView.as_view(),
        name="exchange-approve",
    ),
    path(
        "<int:exchange_id>/reject/",
        ExchangeRejectView.as_view(),
        name="exchange-reject",
    ),
    path(
    "<int:exchange_id>/complete/",
    ExchangeCompleteView.as_view(),
    name="exchange-complete",
    ),
    path(
        "<int:exchange_id>/payment/",
        ExchangePaymentCreateView.as_view(),
        name="exchange-payment-create",
    ),
    path(
        "<int:exchange_id>/payment-status/",
        ExchangePaymentStatusView.as_view(),
        name="exchange-payment-status",
    ),
    path(
        "<int:exchange_id>/refund/",
        ExchangeRefundCreateView.as_view(),
        name="exchange-refund-create",
    ),
    path(
        "refunds/<int:refund_id>/complete/",
        ExchangeRefundCompleteView.as_view(),
        name="exchange-refund-complete",
    ),
]