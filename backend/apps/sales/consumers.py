import json
from channels.generic.websocket import AsyncWebsocketConsumer

class CartConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.transaction_id = self.scope['url_route']['kwargs']['transaction_id']
        self.room_group_name = f'cart_{self.transaction_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from room group (Sent from backend services)
    async def cart_updated(self, event):
        # We forward the event to the laptop frontend over the WebSocket
        await self.send(text_data=json.dumps({
            'type': 'cart.updated',
            'data': event.get('data', {})
        }))
        
    async def cart_error(self, event):
        await self.send(text_data=json.dumps({
            'type': 'cart.error',
            'error': event.get('error', 'Unknown error')
        }))
