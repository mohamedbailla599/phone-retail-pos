from django.urls import path

from apps.users.api_views import (
    POSLoginView,
    POSLogoutView,
    POSMeView,
    POSOperatorClearView,
    POSOperatorCreateView,
    POSOperatorListView,
    POSOperatorManageListView,
    POSOperatorSelectView,
    POSOperatorUpdateView,
)

urlpatterns = [
    path("login/", POSLoginView.as_view(), name="pos-login"),
    path("logout/", POSLogoutView.as_view(), name="pos-logout"),
    path("me/", POSMeView.as_view(), name="pos-me"),
    path("operators/", POSOperatorListView.as_view(), name="pos-operators"),
    path("operators/manage/", POSOperatorManageListView.as_view(), name="pos-operators-manage"),
    path("operators/create/", POSOperatorCreateView.as_view(), name="pos-operators-create"),
    path("operators/<int:pk>/", POSOperatorUpdateView.as_view(), name="pos-operators-update"),
    path("operators/select/", POSOperatorSelectView.as_view(), name="pos-operator-select"),
    path("operators/clear/", POSOperatorClearView.as_view(), name="pos-operator-clear"),
]

