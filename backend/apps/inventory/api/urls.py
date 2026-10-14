from django.urls import path
from apps.inventory.api.views import (
    DeviceListView, AccessoryStockListView,
    ReceiveDeviceView, ReceiveAccessoryView,
    AdjustAccessoryStockView, DeviceStatusChangeView
)

urlpatterns = [
    path("devices/", DeviceListView.as_view(), name="device-list"),
    path("accessories/", AccessoryStockListView.as_view(), name="accessory-list"),
    path("receive/device/", ReceiveDeviceView.as_view(), name="receive-device"),
    path("receive/accessory/", ReceiveAccessoryView.as_view(), name="receive-accessory"),
    path("adjust/accessory/", AdjustAccessoryStockView.as_view(), name="adjust-accessory"),
    path("device/status/", DeviceStatusChangeView.as_view(), name="device-status-change"),
]
