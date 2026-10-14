from django.urls import path

from apps.users.api_views import (
    POSLoginView,
    POSLogoutView,
    POSMeView,
    POSOperatorClearView,
    POSOperatorListView,
    POSOperatorSelectView,
)

urlpatterns = [
    path("login/", POSLoginView.as_view(), name="pos-login"),
    path("logout/", POSLogoutView.as_view(), name="pos-logout"),
    path("me/", POSMeView.as_view(), name="pos-me"),
    path("operators/", POSOperatorListView.as_view(), name="pos-operators"),
    path("operators/select/", POSOperatorSelectView.as_view(), name="pos-operator-select"),
    path("operators/clear/", POSOperatorClearView.as_view(), name="pos-operator-clear"),
]
