from django.urls import path
from .views import (
    ScannerSubmitView, POSCatalogView, SaleCreateView, SaleItemAddView,
    TransactionDetailView, SaleItemRemoveView, SaleCheckoutView, SaleCancelCheckoutView,
    SaleCancelView, SalePaymentView, SaleCompleteView,
    PaymentConfirmView, PaymentRejectView, SaleDiscountView,
    DashboardStatsView, SaleCustomerAssignView, ZReportView
)

app_name = "sales"

urlpatterns = [
    path("reports/z-report/", ZReportView.as_view(), name="z-report"),
    path("dashboard/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("pos-catalog/", POSCatalogView.as_view(), name="pos-catalog"),
    path("", SaleCreateView.as_view(), name="sale-create"),
    path("<int:transaction_id>/", TransactionDetailView.as_view(), name="sale-detail"),
    path("<int:transaction_id>/customer/", SaleCustomerAssignView.as_view(), name="sale-customer-assign"),
    path("<int:transaction_id>/items/", SaleItemAddView.as_view(), name="sale-item-add"),
    path("<int:transaction_id>/items/<int:item_id>/", SaleItemRemoveView.as_view(), name="sale-item-remove"),
    path("<int:transaction_id>/discount/", SaleDiscountView.as_view(), name="sale-discount"),
    path("<int:transaction_id>/checkout/", SaleCheckoutView.as_view(), name="sale-checkout"),
    path("<int:transaction_id>/cancel-checkout/", SaleCancelCheckoutView.as_view(), name="sale-cancel-checkout"),
    path("<int:transaction_id>/cancel/", SaleCancelView.as_view(), name="sale-cancel"),
    path("<int:transaction_id>/payments/", SalePaymentView.as_view(), name="sale-payment"),
    path("<int:transaction_id>/payments/<int:payment_id>/confirm/", PaymentConfirmView.as_view(), name="sale-payment-confirm"),
    path("<int:transaction_id>/payments/<int:payment_id>/reject/", PaymentRejectView.as_view(), name="sale-payment-reject"),
    path("<int:transaction_id>/complete/", SaleCompleteView.as_view(), name="sale-complete"),
    path(
        "<int:transaction_id>/scan/",
        ScannerSubmitView.as_view(),
        name="scanner-submit",
    ),
]
