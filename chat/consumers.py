import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Chat, Message
from django.contrib.auth import get_user_model

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.chat_group_name = f'chat_{self.chat_id}'  # Fix variable name consistency
        self.user = self.scope['user']

        if not self.user.is_authenticated:  # Check if user is authenticated
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.chat_group_name,
            self.channel_name
        )
        
        # Mark messages as seen when connecting to chat
        await self.mark_messages_as_seen()
        
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.chat_group_name,  # Use consistent variable name
            self.channel_name
        )

    async def receive(self, text_data):
        """
        Receive message from WebSocket.
        """
        data = json.loads(text_data)
        message_type = data.get('type')
    
        if message_type == 'chat.message':
            content = data.get('content', '')
        
        # Save the message to the database
            message = await self.save_message(content)
        
        # Prepare message data with all required fields
            message_data = {
                'id': message.id,
                'content': message.content,
                'sender': message.sender.id,
                'seen': message.seen,
                'timestamp': message.timestamp.isoformat(),
            }
        
            # Broadcast message to the chat group
            await self.channel_layer.group_send(
                self.chat_group_name,
                {
                    'type': 'chat_message',
                    'message': message_data
                }
            )
        elif message_type == 'chat.messages_read':
            # Mark messages as read
            count = await self.mark_messages_as_seen()
            
            # Notify the group that messages have been read
            if count > 0:
                await self.channel_layer.group_send(
                    self.chat_group_name,  # Use consistent variable name
                    {
                        'type': 'chat_messages_read',  # Match the handler method name
                        'user_id': self.user.id,
                    }
                )

    async def chat_message(self, event):
        """
        Handler for chat.message type events.
        """
        message = event['message']
        sender_id = message['sender']
        
        # Get the user object asynchronously
        sender = await self.get_user_by_id(sender_id)
        
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'chat.message',  # Include type for client handling
            'message': {
                'id': message['id'],
                'content': message['content'],
                'sender': sender_id,
                'sender_username': sender.username if sender else 'Unknown',
                'timestamp': message['timestamp'],
                'seen': message.get('seen', False)
            }
        }))

    async def chat_messages_read(self, event):
        """
        Handler for chat.messages_read type events.
        """
        await self.send(text_data=json.dumps({
            'type': 'chat.messages_read',
            'user_id': event['user_id']
        }))

    @database_sync_to_async
    def save_message(self, content):
        """Save a new message to the database"""
        chat = Chat.objects.get(id=self.chat_id)
        message = Message.objects.create(
            chat=chat,
            sender=self.user,
            content=content,
            seen=False
        )
        return message
    
    @database_sync_to_async
    def get_user_by_id(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None
            
    @database_sync_to_async
    def mark_message_as_seen(self, message_id):
        try:
            message = Message.objects.get(id=message_id)
            message.seen = True
            message.save()
            return message
        except Message.DoesNotExist:
            return None
            
    @database_sync_to_async
    def mark_messages_as_seen(self):
        """Mark all messages in the chat as seen by the current user"""
        chat = Chat.objects.get(id=self.chat_id)
    
        # Get all unread messages in this chat that were sent by other users
        unread_messages = Message.objects.filter(
            chat=chat,
            seen=False
        ).exclude(sender=self.user)
    
        # Count them for logging
        count = unread_messages.count()
        
        # Mark them as read
        unread_messages.update(seen=True)
    
        # Log for debugging
        print(f"Marked {count} messages as seen in chat {self.chat_id}")
    
        # Return the number of messages marked as seen
        return count