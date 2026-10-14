from django.urls import path
from .views import BarcodeGenerationView, ReceiptGenerationView

app_name = "printing"

urlpatterns = [
    path(
        "barcode/<str:code>/",
        BarcodeGenerationView.as_view(),
        name="generate-barcode",
    ),
    path(
        "receipt/<int:transaction_id>/",
        ReceiptGenerationView.as_view(),
        name="generate-receipt",
    ),
]
