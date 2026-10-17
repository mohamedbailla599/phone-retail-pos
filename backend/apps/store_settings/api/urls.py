from django.urls import path
from .views import StoreSettingsDetailView, DatabaseBackupDownloadView

urlpatterns = [
    path("", StoreSettingsDetailView.as_view(), name="store-settings-detail"),
    path("backup/", DatabaseBackupDownloadView.as_view(), name="store-settings-backup"),
]
