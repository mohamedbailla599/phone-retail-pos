from django.urls import path
from .views import StoreSettingsDetailView

urlpatterns = [
    path("", StoreSettingsDetailView.as_view(), name="store-settings-detail"),
]
