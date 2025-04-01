import json
import traceback
from django.utils import timezone
from datetime import timedelta
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Chat, Message, SwapanzaSession
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Connect to WebSocket and set up user session"""
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.chat_group_name = f'chat_{self.chat_id}'
        self.user = self.scope.get('user', None)

        # If user is None or not authenticated, close the connection
        if not self.user or not self.user.is_authenticated:
            print(f"Rejecting WebSocket connection - User is not authenticated")
            await self.close(code=4001)  # Custom close code for authentication failure
            return

        # Join room group
        await self.channel_layer.group_add(
            self.chat_group_name,
            self.channel_name
        )
    
        # Mark messages as seen when connecting to chat
        await self.mark_messages_as_seen_async()
    
        # FIRST, ACCEPT the connection before sending anything
        await self.accept()
    
        # THEN check if there's an active Swapanza
        await self.check_active_swapanza()

    async def disconnect(self, close_code):
        """Disconnect from WebSocket"""
        # Leave room group
        await self.channel_layer.group_discard(
            self.chat_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """Receive message from WebSocket"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'chat.message')

            if message_type == 'chat.message':
                await self.handle_chat_message(data)
            elif message_type == 'swapanza.request':
                duration = data.get('duration', 5)
                await self.handle_swapanza_request(duration)
            elif message_type == 'swapanza.confirm':
                await self.handle_swapanza_confirm()
            elif message_type == 'swapanza.activate_request':
                await self.handle_swapanza_activate_request()
            elif message_type == 'messages.read':
                await self.handle_messages_read()
        except Exception as e:
            print(f"Error processing message: {str(e)}")
            print(traceback.format_exc())  # Full traceback for debugging
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f"Error processing message: {str(e)}"
            }))

    async def handle_chat_message(self, data):
        """Handle a chat message from the client"""
        content = data.get('content', '').strip()
        if not content:
            return
        
        # Validate message against Swapanza rules
        is_valid, error_message = await self.validate_swapanza_message(content)
        if not is_valid:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': error_message
            }))
            return
        
        # Save the message
        message = await self.save_chat_message(content)
    
        # Update Swapanza message count if needed
        remaining_messages = None
        if message.during_swapanza:
            count = await self.increment_swapanza_message_count()
            remaining_messages = 2 - count  # Max 2 messages allowed
        
        # Broadcast the message to the group
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'id': message.id,
                    'content': message.content,
                    'sender': message.sender.id,
                    'timestamp': message.timestamp.isoformat(),
                    'during_swapanza': message.during_swapanza,
                    'remaining_messages': remaining_messages
                }
            }
        )

    async def chat_message(self, event):
        """Send chat message to WebSocket"""
        message_data = event['message']
    
        # If this is a Swapanza message and the user is the sender, include remaining count
        remaining_messages = None
        if message_data.get('during_swapanza') and str(message_data.get('sender')) == str(self.user.id):
            # Get the current user's remaining message count
            chat = await database_sync_to_async(Chat.objects.get)(id=self.chat_id)
            message_counts = chat.swapanza_message_count or {}
            user_count = message_counts.get(str(self.user.id), 0)
            remaining_messages = 2 - user_count  # Max 2 messages allowed
    
        await self.send(text_data=json.dumps({
            'type': 'chat.message',
            'message': message_data,
            'remaining_messages': remaining_messages
        }))

    async def messages_read(self, event):
        """Send messages read notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'chat.messages_read',
            'user_id': event['user_id']
        }))

    async def handle_messages_read(self):
        """Handle read messages notification"""
        await self.mark_messages_as_seen_async()
        
        # Notify other users that messages have been read
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'messages_read',
                'user_id': self.user.id
            }
        )

    async def handle_swapanza_request(self, duration):
        """Handle a request to start Swapanza"""
        print(f"User {self.user.username} (ID: {self.user.id}) requesting Swapanza in chat {self.chat_id} for {duration} minutes")
        
        # Validate that the user can start a Swapanza
        can_start, reason = await self.can_start_swapanza()
        if not can_start:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': reason or "You or your partner already have an active Swapanza"
            }))
            return
            
        # Update chat with request info
        await self.update_chat_with_swapanza_request(duration)
        
        # Notify participants
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'swapanza_request',
                'duration': duration,
                'requested_by': self.user.id,
                'requested_by_username': self.user.username
            }
        )
        
        print(f"Swapanza request sent by {self.user.username} (ID: {self.user.id}) in chat {self.chat_id}")

    async def swapanza_request(self, event):
        """Send Swapanza request notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.request',
            'duration': event['duration'],
            'requested_by': event['requested_by'],
            'requested_by_username': event['requested_by_username']
        }))
    
    async def handle_swapanza_confirm(self):
        """Handle confirmation of Swapanza participation"""
        try:
            print(f"User {self.user.username} (ID: {self.user.id}) confirming Swapanza in chat {self.chat_id}")
            
            # Check if user can participate
            can_start, reason = await self.can_start_swapanza()
            if not can_start:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': reason or "Cannot join Swapanza - you already have an active session"
                }))
                return
                
            # Add user to confirmed list and check if all confirmed
            all_confirmed, confirmed_users, total_participants = await self.add_swapanza_confirmation()
            
            print(f"Swapanza confirmation in chat {self.chat_id}: {len(confirmed_users)}/{total_participants} users confirmed")
            print(f"Confirmed users: {confirmed_users}")
            
            # Notify about confirmation
            await self.channel_layer.group_send(
                self.chat_group_name,
                {
                    'type': 'swapanza_confirm',
                    'user_id': self.user.id,
                    'username': self.user.username,
                    'all_confirmed': all_confirmed
                }
            )
            
            # If all confirmed, activate immediately from server side only
            if all_confirmed:
                print(f"All users confirmed in chat {self.chat_id}, activating Swapanza...")
                await self.activate_swapanza()
        except Exception as e:
            print(f"Error in handle_swapanza_confirm: {str(e)}")
            print(traceback.format_exc())  # Full traceback for debugging
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Error processing Swapanza confirmation: {str(e)}'
            }))

    async def swapanza_confirm(self, event):
        """Send Swapanza confirmation notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.confirm',
            'user_id': event['user_id'],
            'username': event['username'],
            'all_confirmed': event.get('all_confirmed', False)
        }))
    
    async def handle_swapanza_activate_request(self):
        """Force activation if client detects both confirmed"""
        print(f"Received activation request from user {self.user.id} in chat {self.chat_id}")
        
        # Double-check if all users have confirmed with a fresh database read
        chat = await database_sync_to_async(Chat.objects.get)(id=self.chat_id)
        participants = await database_sync_to_async(lambda: list(chat.participants.values_list('id', flat=True)))()
        confirmed_users = chat.swapanza_confirmed_users or []
        
        all_confirmed = all(str(uid) in confirmed_users for uid in participants)
        
        print(f"Activation request verification: {len(confirmed_users)}/{len(participants)} confirmed")
        print(f"All confirmed: {all_confirmed}")
        
        if all_confirmed:
            await self.activate_swapanza()
        else:
            # Check if we need to wait for the user's own confirmation
            user_confirmed = str(self.user.id) in confirmed_users
            if not user_confirmed:
                # Add this user to confirmed users first
                all_confirmed, confirmed_users, total_participants = await self.add_swapanza_confirmation()
                
                # Now check again if all users are confirmed
                if all_confirmed:
                    await self.activate_swapanza()
                    return
            
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': "Cannot activate Swapanza - not all users have confirmed"
            }))
    
    async def activate_swapanza(self):
        """Activate Swapanza when all users are confirmed"""
        # Get chat details
        chat = await database_sync_to_async(Chat.objects.get)(id=self.chat_id)
        now = timezone.now()
        duration = chat.swapanza_duration or 5
        end_time = now + timedelta(minutes=duration)
        
        print(f"Attempting to activate Swapanza in chat {self.chat_id} for {duration} minutes")
        print(f"Start time: {now.isoformat()}, End time: {end_time.isoformat()}")
        
        # Create sessions in a transaction
        success, error_message = await self.create_swapanza_sessions(now, end_time)
        
        if success:
            print(f"Successfully activated Swapanza in chat {self.chat_id}")
            # Notify all participants
            await self.channel_layer.group_send(
                self.chat_group_name,
                {
                    'type': 'swapanza_activate',
                    'started_at': now.isoformat(),
                    'ends_at': end_time.isoformat()
                }
            )
            
            # Schedule expiration message
            self.schedule_swapanza_expiration(end_time)
        else:
            print(f"Failed to activate Swapanza in chat {self.chat_id}: {error_message}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': error_message or "Failed to create Swapanza sessions"
            }))
    
    def schedule_swapanza_expiration(self, end_time):
        """Schedule a task to send expiration message when Swapanza ends"""
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        import asyncio
        
        async def send_expiration():
            seconds_until_expiry = (end_time - timezone.now()).total_seconds()
            if seconds_until_expiry > 0:
                await asyncio.sleep(seconds_until_expiry)
                
                # Send expiration message to the group
                channel_layer = get_channel_layer()
                await channel_layer.group_send(
                    self.chat_group_name,
                    {
                        'type': 'swapanza_expire'
                    }
                )
                print(f"Sent Swapanza expiration message to chat {self.chat_id}")
        
        # Start the task
        asyncio.create_task(send_expiration())
        print(f"Scheduled Swapanza expiration for chat {self.chat_id} at {end_time.isoformat()}")
    
    async def check_active_swapanza(self):
        """Check if there's an active Swapanza and send state to client"""
        active_swapanza = await self.get_active_swapanza_session()
        
        if active_swapanza:
            # Send current Swapanza state to the user
            partner = await database_sync_to_async(lambda: active_swapanza.partner)()
            
            await self.send(text_data=json.dumps({
                'type': 'swapanza.activate',
                'started_at': active_swapanza.started_at.isoformat(),
                'ends_at': active_swapanza.ends_at.isoformat(),
                'partner_id': partner.id,
                'partner_username': partner.username
            }))
            
            print(f"Sent active Swapanza state to user {self.user.id} in chat {self.chat_id}")

    async def swapanza_activate(self, event):
        """Send Swapanza activation notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.activate',
            'started_at': event['started_at'],
            'ends_at': event['ends_at']
        }))

    async def swapanza_expire(self, event):
        """Send Swapanza expiration notification to WebSocket"""
        print(f"Sending Swapanza expiration notification to user {self.user.id} in chat {self.chat_id}")
        await self.send(text_data=json.dumps({
            'type': 'swapanza.expire'
        }))
        
        # Clean up the Swapanza sessions
        await self.deactivate_swapanza_sessions()

    async def swapanza_logout(self, event):
        """Send Swapanza logout notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.logout'
        }))
    
    @database_sync_to_async
    def deactivate_swapanza_sessions(self):
        """Deactivate all Swapanza sessions for this chat"""
        try:
            chat = Chat.objects.get(id=self.chat_id)
            
            # Get all participants
            participants = list(chat.participants.all())
            
            # Deactivate sessions
            SwapanzaSession.objects.filter(
                user__in=participants,
                chat=chat,
                active=True
            ).update(active=False)
            
            # Update chat state
            chat.swapanza_active = False
            chat.save(update_fields=['swapanza_active'])
            
            print(f"Deactivated Swapanza sessions for chat {self.chat_id}")
            return True
        except Exception as e:
            print(f"Error deactivating Swapanza sessions: {str(e)}")
            return False

    @database_sync_to_async
    def mark_messages_as_seen_async(self):
        """Mark all messages in the chat as seen by the current user"""
        try:
            chat = Chat.objects.get(id=self.chat_id)
            updated = Message.objects.filter(
                chat=chat, 
                seen=False
            ).exclude(sender=self.user).update(seen=True)
            
            print(f"Marked {updated} messages as seen in chat {self.chat_id}")
            return updated
        except Exception as e:
            print(f"Error marking messages as seen: {str(e)}")
            return 0
    
    @database_sync_to_async
    def get_active_swapanza_session(self):
        """Get the user's active Swapanza session in this chat if any"""
        try:
            return SwapanzaSession.objects.filter(
                user=self.user,
                chat_id=self.chat_id,
                active=True,
                ends_at__gt=timezone.now()
            ).first()
        except Exception as e:
            print(f"Error getting active Swapanza session: {str(e)}")
            return None

    @database_sync_to_async
    def save_chat_message(self, content):
        """Save a chat message to the database"""
        chat = Chat.objects.get(id=self.chat_id)
        
        # Check if user is in a Swapanza session
        active_swapanza = SwapanzaSession.objects.filter(
            user=self.user,
            chat=chat,
            active=True,
            ends_at__gt=timezone.now()
        ).first()
        
        during_swapanza = active_swapanza is not None
        
        # Create the message
        message = Message.objects.create(
            chat=chat,
            sender=self.user,
            content=content,
            during_swapanza=during_swapanza
        )
        
        # If during Swapanza, set apparent sender
        if during_swapanza and active_swapanza:
            message.apparent_sender = active_swapanza.partner.id
            message.save(update_fields=['apparent_sender'])
            
        return message

    @database_sync_to_async
    def increment_swapanza_message_count(self):
        """Increment the user's Swapanza message count"""
        chat = Chat.objects.get(id=self.chat_id)
        message_counts = chat.swapanza_message_count or {}
        user_id_str = str(self.user.id)
        
        # Increment the count
        count = message_counts.get(user_id_str, 0) + 1
        message_counts[user_id_str] = count
        
        # Update the chat
        chat.swapanza_message_count = message_counts
        chat.save(update_fields=['swapanza_message_count'])
        
        # Also update the SwapanzaSession
        SwapanzaSession.objects.filter(
            user=self.user,
            chat=chat,
            active=True
        ).update(message_count=count)
        
        return count

    @database_sync_to_async
    def update_chat_with_swapanza_request(self, duration):
        """Update chat with Swapanza request info"""
        chat = Chat.objects.get(id=self.chat_id)
        
        # Reset any previous Swapanza state if not active
        if not chat.swapanza_active:
            chat.swapanza_requested_by = self.user
            chat.swapanza_duration = duration
            chat.swapanza_confirmed_users = []
            chat.save(update_fields=[
                'swapanza_requested_by',
                'swapanza_duration',
                'swapanza_confirmed_users'
            ])
        
        return chat

    @database_sync_to_async
    def create_swapanza_sessions(self, start_time, end_time):
        """Create Swapanza sessions in a transaction"""
        try:
            with transaction.atomic():
                chat = Chat.objects.get(id=self.chat_id)
                
                # Double check if Swapanza is already active
                if chat.swapanza_active and chat.swapanza_ends_at and chat.swapanza_ends_at > timezone.now():
                    return False, "A Swapanza is already active in this chat"
                
                participants = list(chat.participants.all())
                
                if len(participants) < 2:
                    raise ValueError("Need at least 2 participants for Swapanza")
                
                # Check if any participants have active Swapanza elsewhere
                active_sessions = SwapanzaSession.objects.filter(
                    user__in=participants,
                    active=True,
                    ends_at__gt=timezone.now()
                ).exclude(chat=chat)
                
                if active_sessions.exists():
                    # Get users with active sessions
                    active_users = active_sessions.values_list('user__username', flat=True)
                    return False, f"Cannot start Swapanza: {', '.join(active_users)} already have active Swapanza sessions"
                
                # Deactivate existing sessions for this chat
                SwapanzaSession.objects.filter(
                    chat=chat,
                    active=True
                ).update(active=False)
                
                # Create new sessions
                user1, user2 = participants[:2]
                SwapanzaSession.objects.create(
                    user=user1, partner=user2,
                    started_at=start_time, ends_at=end_time,
                    active=True, message_count=0, chat=chat
                )
                SwapanzaSession.objects.create(
                    user=user2, partner=user1,
                    started_at=start_time, ends_at=end_time,
                    active=True, message_count=0, chat=chat
                )
                
                # Update chat state
                chat.swapanza_active = True
                chat.swapanza_started_at = start_time
                chat.swapanza_ends_at = end_time
                chat.swapanza_message_count = {}
                chat.save(update_fields=['swapanza_active', 'swapanza_started_at', 'swapanza_ends_at', 'swapanza_message_count'])
            
            return True, None
        except Exception as e:
            print(f"Error creating Swapanza sessions: {str(e)}")
            print(traceback.format_exc())  # Full traceback for debugging
            return False, str(e)

    @database_sync_to_async
    def can_start_swapanza(self):
        """Check if user can start or join a Swapanza"""
        from django.db.models import Q
        
        user = self.user
        now = timezone.now()
        
        # Check for active sessions
        active_session = SwapanzaSession.objects.filter(
            Q(user=user) | Q(partner=user),
            active=True,
            ends_at__gt=now
        ).first()
        
        if active_session:
            if active_session.chat_id == int(self.chat_id):
                # Active in this chat is okay
                return True, None
            return False, f"You already have an active Swapanza in chat with {active_session.partner.username}"
        
        # Check for active chat swapanzas
        active_chat = Chat.objects.filter(
            participants=user,
            swapanza_active=True,
            swapanza_ends_at__gt=now
        ).exclude(id=self.chat_id).first()
        
        if active_chat:
            return False, f"You already have an active Swapanza in another chat"
        
        return True, None

    @database_sync_to_async
    def add_swapanza_confirmation(self):
        """Add user to confirmed list and check if all confirmed"""
        chat = Chat.objects.get(id=self.chat_id)
        confirmed_users = chat.swapanza_confirmed_users or []
        
        user_id_str = str(self.user.id)
        if user_id_str not in confirmed_users:
            confirmed_users.append(user_id_str)
            chat.swapanza_confirmed_users = confirmed_users
            chat.save(update_fields=['swapanza_confirmed_users'])
        
        # Check if all participants confirmed
        participants = list(chat.participants.values_list('id', flat=True))
        all_confirmed = all(str(uid) in confirmed_users for uid in participants)
        
        return all_confirmed, confirmed_users, len(participants)

    @database_sync_to_async
    def validate_swapanza_message(self, content):
        """Validate a message against Swapanza rules"""
        # Check if user is in a Swapanza session
        active_swapanza = SwapanzaSession.objects.filter(
            user=self.user,
            chat_id=self.chat_id,
            active=True,
            ends_at__gt=timezone.now()
        ).first()
        
        if not active_swapanza:
            return True, None  # Not in Swapanza, message is valid
            
        # Apply Swapanza rules
        if len(content) > 7:
            return False, "During Swapanza, messages are limited to 7 characters"
            
        if ' ' in content:
            return False, "During Swapanza, spaces are not allowed in messages"
            
        # Check message count
        chat = Chat.objects.get(id=self.chat_id)
        message_counts = chat.swapanza_message_count or {}
        user_count = message_counts.get(str(self.user.id), 0)
        
        if user_count >= 2:
            return False, "You have reached your message limit (2) during this Swapanza"
            
        return True, None