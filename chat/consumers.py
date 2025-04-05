import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError
from .models import Chat, Message, SwapanzaSession
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import AccessToken
from django.db.models import Q
import asyncio

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Connect to WebSocket and set up user session"""
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.chat_group_name = f'chat_{self.chat_id}'
        self.user = self.scope.get('user', None)

        # If user is None or not authenticated, close the connection
        if not self.user or not self.user.is_authenticated:
            print(f"Rejecting WebSocket connection - User is not authenticated")
            await self.close(code=4001)
            return

        # Join room group
        await self.channel_layer.group_add(
            self.chat_group_name,
            self.channel_name
        )

        # Mark messages as seen when connecting to chat
        updated_count = await self.mark_messages_as_seen_async()
    
        # FIRST, ACCEPT the connection before sending anything else
        await self.accept()

        # If messages were marked as read, notify other users
        if updated_count > 0:
            await self.channel_layer.group_send(
                self.chat_group_name,
                {
                    'type': 'messages_read',
                    'user_id': self.user.id
                }
            )

        # Check for global Swapanza state and send to client
        global_state = await self.get_global_swapanza_state()
        if global_state['active']:
            partner = global_state['partner']
            await self.send(text_data=json.dumps({
                'type': 'swapanza.activate',
                'started_at': global_state['started_at'].isoformat(),
                'ends_at': global_state['ends_at'].isoformat(),
                'partner_id': partner.id,
                'partner_username': partner.username,
                'partner_profile_image': partner.profile_image_url if hasattr(partner, 'profile_image_url') else None,
                'message_count': global_state['message_count'],
                'remaining_messages': global_state['remaining_messages']
            }))
    
        # Also check chat-specific Swapanza
        await self.check_active_swapanza()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.chat_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            print(f"Received WebSocket message: {data}")
            message_type = data.get('type', '')

            if message_type == 'chat.message':
                content = data.get('content', '').strip()
                if not content:
                    return
                
                # Save message and get response data
                message_data = await self.save_chat_message(content)
                
                # Check if there was an error in message validation
                if message_data.get('error'):
                    # Send error back to the client
                    await self.send(text_data=json.dumps({
                        'type': 'chat.message.error',
                        'message': message_data['message'],
                        'content': message_data['content']
                    }))
                    return
                
                # Send message to room group
                await self.channel_layer.group_send(
                    self.chat_group_name,
                    {
                        'type': 'chat_message',
                        'message': message_data
                    }
                )
            
            elif message_type == 'swapanza.request':
                duration = data.get('duration', 5)
                success, message = await self.create_swapanza_request(duration)
                
                if not success:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': message
                    }))
                    return
                
                # Broadcast the request to all users in the chat
                await self.channel_layer.group_send(
                    self.chat_group_name,
                    {
                        'type': 'swapanza_request',
                        'requested_by': self.user.id,
                        'requested_by_username': self.user.username,
                        'duration': duration
                    }
                )
            
            elif message_type == 'swapanza.confirm':
                success, message, all_confirmed = await self.confirm_swapanza()
                
                if not success:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': message
                    }))
                    return
                
                # Broadcast confirmation to all users in the chat
                await self.channel_layer.group_send(
                    self.chat_group_name,
                    {
                        'type': 'swapanza_confirm',
                        'user_id': self.user.id,
                        'username': self.user.username,
                        'all_confirmed': all_confirmed
                    }
                )
                
                # If all users confirmed, activate the Swapanza after a short delay
                if all_confirmed:
                    await asyncio.sleep(2)  # Give clients time to display confirmation
                    success, message, data = await self.activate_swapanza()
                    
                    if success:
                        await self.channel_layer.group_send(
                            self.chat_group_name,
                            {
                                'type': 'swapanza_activate',
                                'started_at': data['started_at'].isoformat(),
                                'ends_at': data['ends_at'].isoformat(),
                                'partner_id': data['partner_id'],
                                'partner_username': data['partner_username'],
                                'partner_profile_image': data.get('partner_profile_image')
                            }
                        )
                    else:
                        await self.send(text_data=json.dumps({
                            'type': 'error',
                            'message': message
                        }))
        
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
        except Exception as e:
            import traceback
            print(f"Error processing message: {str(e)}")
            print(traceback.format_exc())
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Server error: ' + str(e)
            }))

    # Get the user's global Swapanza state
    @database_sync_to_async
    def get_global_swapanza_state(self):
        """Get the user's global Swapanza state across all chats"""
        user = self.user
        now = timezone.now()
        chat_id = self.chat_id
    
        # Check for active Swapanza session
        active_session = SwapanzaSession.objects.filter(
            user=user,
            active=True,
            ends_at__gt=now
        ).first()
    
        if not active_session:
            return {'active': False}
    
        # Get message count for the current chat only
        # If session is tied to a chat, use that chat's message count
        if active_session.chat:
            chat = active_session.chat
            # Check if this is a different chat than the primary Swapanza chat
            if int(self.chat_id) != chat.id:
                # For other chats, check if there's any message count data
                current_chat = Chat.objects.get(id=self.chat_id)
                chat_message_counts = current_chat.swapanza_message_count or {}
                message_count = chat_message_counts.get(str(user.id), 0)
            else:
                # For the primary Swapanza chat, use its message count
                chat_message_counts = chat.swapanza_message_count or {}
                message_count = chat_message_counts.get(str(user.id), 0)
        else:
            # If no chat is associated, count messages in the current chat
            message_count = Message.objects.filter(
                sender=user,
                chat_id=chat_id,
                during_swapanza=True,
                created_at__gte=active_session.started_at
            ).count()
    
        return {
            'active': True,
            'partner': active_session.partner,
            'started_at': active_session.started_at,
            'ends_at': active_session.ends_at,
            'message_count': message_count,
            'remaining_messages': max(0, 2 - message_count),
            'chat_id': active_session.chat.id if active_session.chat else None
        }

    # Save message to database
    @database_sync_to_async
    def save_chat_message(self, content):
        """Save a chat message to the database with Swapanza validation"""
        user = self.user
        chat = Chat.objects.get(id=self.chat_id)
        now = timezone.now()
    
        # Check for active Swapanza session
        active_session = SwapanzaSession.objects.filter(
            user=user,
            active=True,
            ends_at__gt=now
        ).first()
    
        # Set during_swapanza based on global session
        during_swapanza = active_session is not None
    
        # Perform Swapanza validations if needed
        if during_swapanza:
            # Count messages sent in THIS SPECIFIC CHAT during the active Swapanza
            chat_messages_sent = Message.objects.filter(
                sender=user,
                chat=chat,  # Filter by current chat
                during_swapanza=True,
                created_at__gte=active_session.started_at
            ).count()
            
            # Check per-chat limit instead of global limit
            if chat_messages_sent >= 2:
                return {
                    'error': True,
                    'message': "You have reached your message limit for this chat during Swapanza",
                    'content': content
                }
            
            # Keep these other validations the same
            if len(content) > 7:
                return {
                    'error': True,
                    'message': "During Swapanza, messages must be 7 characters or less",
                    'content': content
                }
    
            if ' ' in content:
                return {
                    'error': True,
                    'message': "During Swapanza, spaces are not allowed in messages",
                    'content': content
                }
                
            # Only set the apparent_sender in the original Swapanza chat
            if active_session.chat_id == int(self.chat_id):
                apparent_sender = active_session.partner
            else:
                apparent_sender = None
        else:
            apparent_sender = None
    
        # Create and save the message
        message = Message.objects.create(
            sender=user,
            chat=chat,
            content=content,
            during_swapanza=during_swapanza,
            apparent_sender=apparent_sender
        )
    
        # Update message counts - now per-chat
        remaining_messages = None
        if during_swapanza:
            # Calculate CHAT-SPECIFIC remaining messages after creating the new message
            chat_messages_count = Message.objects.filter(
                sender=user,
                chat=chat,  # Specific to this chat
                during_swapanza=True,
                created_at__gte=active_session.started_at
            ).count()
            
            # Calculate remaining messages for this chat
            remaining_messages = max(0, 2 - chat_messages_count)
            
            # Update counter in the current chat
            chat.refresh_from_db(fields=['swapanza_message_count'])
            chat_message_counts = chat.swapanza_message_count or {}
            user_id_str = str(user.id)
            
            # Update to match actual count for this chat
            chat_message_counts[user_id_str] = chat_messages_count
            chat.swapanza_message_count = chat_message_counts
            chat.save(update_fields=['swapanza_message_count'])
    
        return {
            'id': message.id,
            'sender': user.id,
            'content': content,
            'created_at': message.created_at.isoformat(),
            'during_swapanza': during_swapanza,
            'apparent_sender': apparent_sender.id if apparent_sender else None,
            'remaining_messages': remaining_messages
        }

    # Check if chat has active Swapanza
    @database_sync_to_async
    def check_active_swapanza(self):
        """Check if the current chat has an active Swapanza and notify client"""
        chat = Chat.objects.get(id=self.chat_id)
        now = timezone.now()
        user = self.user
    
        # First check if this specific chat has an active Swapanza
        if chat.swapanza_active and chat.swapanza_ends_at and chat.swapanza_ends_at > now:
            # Find the other participant
            participants = list(chat.participants.all())
            if len(participants) < 2:
                return
    
            other_participant = None
            for p in participants:
                if p.id != self.user.id:
                    other_participant = p
                    break
    
            if not other_participant:
                return
    
            # Get the current message count for this user
            chat_message_counts = chat.swapanza_message_count or {}
            user_id_str = str(self.user.id)
            current_count = chat_message_counts.get(user_id_str, 0)
    
            # Calculate remaining messages
            remaining_messages = max(0, 2 - current_count)
        
            # Log the values for debugging
            print(f"Active Swapanza in chat {chat.id} - user {user_id_str} has {current_count} messages, {remaining_messages} remaining")
    
            # Send current Swapanza state to the client
            return self.send(text_data=json.dumps({
                'type': 'swapanza.activate',
                'started_at': chat.swapanza_started_at.isoformat(),
                'ends_at': chat.swapanza_ends_at.isoformat(),
                'partner_id': other_participant.id,
                'partner_username': other_participant.username,
                'partner_profile_image': other_participant.profile_image_url if hasattr(other_participant, 'profile_image_url') else None,
                'remaining_messages': remaining_messages
            }))
        else:
            # Check if there's an active global Swapanza session instead
            active_session = SwapanzaSession.objects.filter(
                user=self.user,
                active=True,
                ends_at__gt=now
            ).first()
            
            if active_session and active_session.chat_id != int(self.chat_id):
                # For other chats during Swapanza, count messages in THIS chat, not original chat
                current_count = Message.objects.filter(
                    sender=user,
                    chat_id=self.chat_id,  # Use current chat ID
                    during_swapanza=True,
                    created_at__gte=active_session.started_at
                ).count()
                
                # Calculate remaining messages for THIS chat
                remaining_messages = max(0, 2 - current_count)
                
                print(f"Global Swapanza active - user {user.id} has used {current_count} messages in chat {self.chat_id}, {remaining_messages} remaining")
                
                # Send Swapanza activation message with remaining count
                return self.send(text_data=json.dumps({
                    'type': 'swapanza.activate',
                    'started_at': active_session.started_at.isoformat(),
                    'ends_at': active_session.ends_at.isoformat(),
                    'partner_id': active_session.partner.id,
                    'partner_username': active_session.partner.username,
                    'partner_profile_image': active_session.partner.profile_image_url if hasattr(active_session.partner, 'profile_image_url') else None,
                    'remaining_messages': remaining_messages
                }))
    # Create a Swapanza request
    @database_sync_to_async
    def create_swapanza_request(self, duration):
        """Create a Swapanza request for the current chat"""
        try:
            chat = Chat.objects.get(id=self.chat_id)
    
            # Check if Swapanza is already active in this chat
            if chat.swapanza_active and chat.swapanza_ends_at and chat.swapanza_ends_at > timezone.now():
                return False, "A Swapanza is already active in this chat"
    
            # Check if there's a pending request
            if chat.swapanza_requested_by:
                # If the request is older than 2 minutes, consider it stale and reset it
                if chat.swapanza_requested_at:
                    two_minutes_ago = timezone.now() - timezone.timedelta(minutes=2)
                    if chat.swapanza_requested_at < two_minutes_ago:
                        print(f"Clearing stale Swapanza request from {chat.swapanza_requested_by.username}")
                        chat.swapanza_requested_by = None
                        chat.swapanza_confirmed_users = []
                        # Continue with the new request
                    else:
                        return False, "A Swapanza request is already pending"
                else:
                    # If there's no timestamp, it's likely an old request (pre-feature)
                    # Go ahead and reset it
                    chat.swapanza_requested_by = None
                    chat.swapanza_confirmed_users = []
    
            # Check if any participants have active Swapanza elsewhere
            participants = list(chat.participants.all())
            active_sessions = SwapanzaSession.objects.filter(
                user__in=participants,
                active=True,
                ends_at__gt=timezone.now()
            )
    
            if active_sessions.exists():
                # Get users with active sessions
                active_users = set(active_sessions.values_list('user__username', flat=True))
                users_str = ", ".join(active_users)
                return False, f"Cannot start Swapanza: {users_str} already have active Swapanza sessions"
    
            # Create request - Use self.user (User instance) instead of self.user.id
            chat.swapanza_requested_by = self.user  # Use User instance
            chat.swapanza_duration = duration
            chat.swapanza_confirmed_users = []  # Reset confirmed users
            chat.swapanza_requested_at = timezone.now()  # Add timestamp
            chat.save(update_fields=[
                'swapanza_requested_by', 
                'swapanza_duration', 
                'swapanza_confirmed_users',
                'swapanza_requested_at'
            ])
    
            return True, None
        except Exception as e:
            print(f"Error creating Swapanza request: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return False, str(e)

    # Confirm participation in a Swapanza
    @database_sync_to_async
    def confirm_swapanza(self):
        """Confirm user's participation in a Swapanza"""
        try:
            chat = Chat.objects.get(id=self.chat_id)
            
            # Check if Swapanza request exists
            if not chat.swapanza_requested_by:
                return False, "No Swapanza request exists", False
            
            # Check if Swapanza is already active
            if chat.swapanza_active:
                return False, "Swapanza is already active", False
            
            # Get confirmed users list
            confirmed_users = chat.swapanza_confirmed_users or []
            
            # Check if user already confirmed
            if str(self.user.id) in confirmed_users:
                return True, "Already confirmed", False
            
            # Add user to confirmed users
            confirmed_users.append(str(self.user.id))
            chat.swapanza_confirmed_users = confirmed_users
            chat.save(update_fields=['swapanza_confirmed_users'])
            
            # Check if all participants have confirmed
            participants = list(chat.participants.all())
            all_confirmed = len(confirmed_users) == len(participants)
            
            return True, "Confirmation successful", all_confirmed
        except Exception as e:
            print(f"Error confirming Swapanza: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return False, str(e), False

    # Activate Swapanza
    @database_sync_to_async
    def activate_swapanza(self):
        """Activate Swapanza after all participants have confirmed"""
        try:
            with transaction.atomic():
                chat = Chat.objects.get(id=self.chat_id)
                
                # Check if Swapanza request exists
                if not chat.swapanza_requested_by:
                    return False, "No Swapanza request exists", None
                
                # Check if all participants have confirmed
                participants = list(chat.participants.all())
                confirmed_users = chat.swapanza_confirmed_users or []
                if len(confirmed_users) != len(participants):
                    return False, "Not all participants have confirmed", None
                
                # Set Swapanza duration
                duration = chat.swapanza_duration or 5
                start_time = timezone.now()
                end_time = start_time + timezone.timedelta(minutes=duration)
                
                # Update chat with Swapanza state
                chat.swapanza_active = True
                chat.swapanza_started_at = start_time
                chat.swapanza_ends_at = end_time
                chat.swapanza_message_count = {}  # Reset message count
                chat.save(update_fields=[
                    'swapanza_active', 
                    'swapanza_started_at', 
                    'swapanza_ends_at', 
                    'swapanza_message_count'
                ])
                
                # Create Swapanza sessions for all participants
                created_sessions = []
                for i, user1 in enumerate(participants):
                    for j, user2 in enumerate(participants):
                        if i != j:  # Don't create a session for a user with themselves
                            # Deactivate any existing active sessions
                            SwapanzaSession.objects.filter(
                                user=user1,
                                active=True
                            ).update(active=False)
                            
                            # Create new session
                            session = SwapanzaSession.objects.create(
                                user=user1,
                                partner=user2,
                                chat=chat,
                                started_at=start_time,
                                ends_at=end_time,
                                active=True
                            )
                            created_sessions.append(session)
                
                # Get info for the current user's partner
                current_user_session = next(
                    (s for s in created_sessions if s.user.id == self.user.id), 
                    None
                )
                
                if not current_user_session:
                    return False, "Could not create Swapanza session for current user", None
                
                partner = current_user_session.partner
                
                return True, "Swapanza activated successfully", {
                    'started_at': start_time,
                    'ends_at': end_time,
                    'partner_id': partner.id,
                    'partner_username': partner.username,
                    'partner_profile_image': partner.profile_image_url if hasattr(partner, 'profile_image_url') else None
                }
        except Exception as e:
            print(f"Error activating Swapanza: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return False, str(e), None

    
    
    async def chat_message(self, event):
        """Send chat message to WebSocket"""
        message = event['message']
        
        await self.send(text_data=json.dumps({
            'type': 'chat.message',
            **message
        }))
    
    async def messages_read(self, event):
        """Notify WebSocket that messages have been read"""
        await self.send(text_data=json.dumps({
            'type': 'chat.messages_read',
            'user_id': event['user_id']
        }))
    
    async def swapanza_request(self, event):
        """Send Swapanza request to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.request',
            'requested_by': event['requested_by'],
            'requested_by_username': event['requested_by_username'],
            'duration': event['duration']
        }))
    
    async def swapanza_confirm(self, event):
        """Send Swapanza confirmation to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.confirm',
            'user_id': event['user_id'],
            'username': event['username'],
            'all_confirmed': event['all_confirmed']
        }))
    
    async def swapanza_activate(self, event):
        """Send Swapanza activation to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.activate',
            'started_at': event['started_at'],
            'ends_at': event['ends_at'],
            'partner_id': event['partner_id'],
            'partner_username': event['partner_username'],
            'partner_profile_image': event.get('partner_profile_image')
        }))
    
    async def swapanza_expire(self, event):
        """Notify WebSocket that Swapanza has expired"""
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
        
            # Get all messages that are not yet read by this user
            unread_messages = Message.objects.filter(
                chat=chat
            ).exclude(
                read_by=self.user
            ).exclude(
                sender=self.user
            )
        
            # Add user to read_by for each message
            updated_count = 0
            for message in unread_messages:
                message.read_by.add(self.user)
                updated_count += 1
        
            print(f"Marked {updated_count} messages as read in chat {self.chat_id}")
            return updated_count
        except Exception as e:
            print(f"Error marking messages as read: {str(e)}")
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

    