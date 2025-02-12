import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Chat, Message
from django.contrib.auth import get_user_model

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.room_group_name = f'chat_{self.chat_id}'
        self.user = self.scope['user']

        if not self.user:
            await self.close()
            return

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

    async def receive(self, text_data):
        data = json.loads(text_data)
        content = data['content']
        sender = data['sender']

        # Save message to database
        message = await self.save_message(content, sender)

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'id': message.id,
                    'content': message.content,
                    'sender': sender,
                    'created_at': message.created_at.isoformat()
                }
            }
        )

    async def chat_message(self, event):
        message = event['message']
        sender_id = message['sender']  # Extract sender_id from the message
        
        # Get the user object asynchronously
        sender = await self.get_user_by_id(sender_id)
        
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': {
                'id': message['id'],
                'content': message['content'],
                'sender': sender.username if sender else 'Unknown',  # Use username instead of id
                'created_at': message['created_at']
            }
        }))

    @database_sync_to_async
    def save_message(self, content, sender_id):
        chat = Chat.objects.get(id=self.chat_id)
        user = User.objects.get(id=sender_id)
        return Message.objects.create(
            chat=chat,
            sender=user,
            content=content
        )
    
    @database_sync_to_async
    def get_user_by_id(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None