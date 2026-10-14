from django.urls import path
from .views import (
    CustomerListCreateView,
    CustomerDetailView,
    CustomerDebtPaymentCreateView,
    CustomerStatsView,
)

app_name = 'customers'

urlpatterns = [
    path('', CustomerListCreateView.as_view(), name='customer-list-create'),
    path('stats/', CustomerStatsView.as_view(), name='customer-stats'),
    path('<int:pk>/', CustomerDetailView.as_view(), name='customer-detail'),
    path('<int:pk>/debt-payments/', CustomerDebtPaymentCreateView.as_view(), name='customer-debt-payment'),
]
