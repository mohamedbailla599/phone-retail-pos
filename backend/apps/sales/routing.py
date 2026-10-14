from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path('ws/cart/<int:transaction_id>/', consumers.CartConsumer.as_asgi()),
]
