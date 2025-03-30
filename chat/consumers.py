import json
from django.utils import timezone
from datetime import timedelta
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
        message_type = data.get('type', 'chat.message')
    
        if message_type == 'chat.message':
            await self.handle_chat_message(data)
        elif message_type == 'swapanza.request':
            duration = data.get('duration', 5)
            await self.handle_swapanza_request(duration)
        elif message_type == 'swapanza.confirm':
           
            await self.handle_swapanza_confirm()
        elif message_type == 'messages.read':
            await self.handle_messages_read()
        
    async def handle_chat_message(self, data):
        """Handle regular chat messages"""
        content = data.get('content', '')
        
        # Check if this chat is in Swapanza mode
        chat_info = await self.get_chat_info()
        
        if chat_info['swapanza_active']:
            # Validate message against Swapanza rules
            is_valid, error = await self.validate_swapanza_message(content)
            
            if not is_valid:
                # Send error message to the sender
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': error
                }))
                return
            
            # If valid, increment message count
            await self.increment_swapanza_message_count()
        
        # Create and save the message
        message = await self.save_message(content, chat_info['swapanza_active'])
        
        # Send message to chat group
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'chat_message',
                'id': message['id'],
                'sender': message['sender'],
                'content': message['content'],
                'timestamp': message['timestamp'],
                'during_swapanza': message['during_swapanza']
            }
        )
    
    async def handle_swapanza_request(self, duration):
        """Handle a request to start Swapanza"""
        # Update chat with Swapanza request info
        chat = await self.update_chat_with_swapanza_request(duration)
        
        # Send notification to the group
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'swapanza_request',
                'duration': duration,
                'requested_by': self.user.id,
                'requested_by_username': self.user.username
            }
        )
    
    async def handle_swapanza_confirm(self):
        """Handle confirmation of Swapanza participation"""
        try:
         # Add user to confirmed participants and check if all users confirmed
            all_confirmed, start_time, end_time = await self.confirm_swapanza()
        
            if all_confirmed:
                # All participants confirmed, activate Swapanza
                await self.channel_layer.group_send(
                    self.chat_group_name,
                    {
                        'type': 'swapanza_activate',
                        'started_at': start_time.isoformat() if start_time else None,
                        'ends_at': end_time.isoformat() if end_time else None
                    }
                )
            else:
                # Just this user confirmed, notify others
                await self.channel_layer.group_send(
                    self.chat_group_name,
                    {
                        'type': 'swapanza_confirm',
                        'user_id': self.user.id,
                        'username': self.user.username
                    }
                )
        except Exception as e:
            # Log the error and prevent it from crashing the WebSocket
            print(f"Error in handle_swapanza_confirm: {str(e)}")
            # Notify the client about the error
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Error processing Swapanza confirmation'
            }))
    
    # Add these handler methods for each message type
    async def chat_message(self, event):
        """Send chat message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'chat.message',
            'id': event['id'],
            'sender': event['sender'],
            'content': event['content'],
            'timestamp': event['timestamp'],
            'during_swapanza': event['during_swapanza']
        }))
    
    async def swapanza_request(self, event):
        """Send Swapanza request notification"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.request',
            'duration': event['duration'],
            'requested_by': event['requested_by'],
            'requested_by_username': event['requested_by_username']
        }))
    
    async def swapanza_confirm(self, event):
        """Send Swapanza confirmation notification"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.confirm',
            'user_id': event['user_id'],
            'username': event['username']
        }))
    
    async def swapanza_activate(self, event):
        """Send Swapanza activation notification"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.activate',
            'started_at': event['started_at'],
            'ends_at': event['ends_at']
        }))
    
    async def swapanza_expire(self, event):
        """Send Swapanza expiration notification"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.expire'
        }))
    
    # Helper methods
    @database_sync_to_async
    def get_chat_info(self):
        """Get chat information including Swapanza status"""
        chat = Chat.objects.get(id=self.chat_id)
        return {
            'swapanza_active': chat.swapanza_active,
            'swapanza_started_at': chat.swapanza_started_at,
            'swapanza_ends_at': chat.swapanza_ends_at,
            'swapanza_message_count': chat.swapanza_message_count
        }
    
    @database_sync_to_async
    def validate_swapanza_message(self, content):
        """Validate a message against Swapanza rules"""
        if len(content) > 7:
            return False, "During Swapanza, messages are limited to 7 characters"
        
        if ' ' in content:
            return False, "During Swapanza, spaces are not allowed in messages"
        
        # Check message count limit
        chat = Chat.objects.get(id=self.chat_id)
        user_id_str = str(self.user.id)
        
        message_counts = chat.swapanza_message_count or {}
        user_message_count = message_counts.get(user_id_str, 0)
        
        if user_message_count >= 2:
            return False, "You have reached your message limit (2) during this Swapanza"
        
        return True, None
    
    @database_sync_to_async
    def increment_swapanza_message_count(self):
        """Increment user's message count during Swapanza"""
        chat = Chat.objects.get(id=self.chat_id)
        user_id_str = str(self.user.id)
        
        message_counts = chat.swapanza_message_count or {}
        message_counts[user_id_str] = message_counts.get(user_id_str, 0) + 1
        
        chat.swapanza_message_count = message_counts
        chat.save(update_fields=['swapanza_message_count'])
    
    @database_sync_to_async
    def update_chat_with_swapanza_request(self, duration):
        """Update chat with Swapanza request information"""
        chat = Chat.objects.get(id=self.chat_id)
        chat.swapanza_requested_by = self.user
        chat.swapanza_duration = duration
        chat.save()
        return chat
    
    @database_sync_to_async
    def confirm_swapanza(self):
        """Confirm user's participation in Swapanza"""
        chat = Chat.objects.get(id=self.chat_id)

        # Get confirmed users list from database or initialize empty list
        confirmed_users = chat.swapanza_confirmed_users or []
    
        # Add this user to confirmed list if not already there
        user_id_str = str(self.user.id)
        if user_id_str not in confirmed_users:
            confirmed_users.append(user_id_str)
            chat.swapanza_confirmed_users = confirmed_users
            chat.save(update_fields=['swapanza_confirmed_users'])
    
        # Get all participant IDs
        all_participants = list(chat.participants.values_list('id', flat=True))
    
        # Check if all participants confirmed
        all_confirmed = all(str(p_id) in confirmed_users for p_id in all_participants)
    
        # If all confirmed, activate Swapanza
        if all_confirmed:
            now = timezone.now()
            chat.swapanza_active = True
            chat.swapanza_started_at = now
            chat.swapanza_ends_at = now + timedelta(minutes=chat.swapanza_duration or 5)
            chat.swapanza_message_count = {}  # Reset message counts
            chat.save()
        
            return True, chat.swapanza_started_at, chat.swapanza_ends_at
        else:
            return False, None, None
    
    @database_sync_to_async
    def save_message(self, content, during_swapanza=False):
        """Save a message to the database"""
        # Existing save_message code with during_swapanza added
        chat = Chat.objects.get(id=self.chat_id)
        message = Message.objects.create(
            chat=chat,
            sender=self.user,
            content=content,
            during_swapanza=during_swapanza
        )
        
        return {
            'id': message.id,
            'sender': message.sender.id,
            'content': message.content,
            'timestamp': message.timestamp.isoformat(),
            'during_swapanza': message.during_swapanza
        }
    
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