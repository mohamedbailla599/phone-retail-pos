from django.urls import path
from .views import (
    ReservationListView,
    ReservationDetailView,
    ReservationCompleteView,
    ReservationCancelView,
    ReservationAddPaymentView,
    ReservationStatsView,
)

urlpatterns = [
    path("", ReservationListView.as_view(), name="reservation-list"),
    path("stats/", ReservationStatsView.as_view(), name="reservation-stats"),
    path("<int:reservation_id>/", ReservationDetailView.as_view(), name="reservation-detail"),
    path("<int:reservation_id>/complete/", ReservationCompleteView.as_view(), name="reservation-complete"),
    path("<int:reservation_id>/cancel/", ReservationCancelView.as_view(), name="reservation-cancel"),
    path("<int:reservation_id>/payments/", ReservationAddPaymentView.as_view(), name="reservation-add-payment"),
]
