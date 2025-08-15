import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError
from .models import Chat, Message, SwapanzaSession
from django.contrib.auth import get_user_model
User = get_user_model()
from rest_framework_simplejwt.tokens import AccessToken
from django.db.models import Q
import asyncio
import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.contrib.auth.models import AnonymousUser
import traceback
from asgiref.sync import sync_to_async
logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        """Connect to WebSocket and set up user session"""
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.chat_group_name = f'chat_{self.chat_id}'
        self.user = self.scope.get('user', None)

        logger.info(f"WebSocket CONNECT attempt: User {getattr(self.user, 'username', 'anonymous')} (ID: {getattr(self.user, 'id', 'none')}) to chat {self.chat_id}")
        
        if not self.user or not self.user.is_authenticated:
            logger.warning("Rejecting WebSocket connection - User is not authenticated")
            await self.close(code=4001)
            return

        logger.info(f"WebSocket authentication successful for user {self.user.username}")
        
        await self.channel_layer.group_add(self.chat_group_name,
                                           self.channel_name)

        
        updated_count = await self.mark_messages_as_seen_async()

        
        await self.accept()
        logger.info(f"WebSocket connection ACCEPTED for user {self.user.username} in chat {self.chat_id}")

        
        if updated_count > 0:
            await self.channel_layer.group_send(self.chat_group_name, {
                'type': 'messages_read',
                'user_id': self.user.id
            })

        
        global_state = await self.get_global_swapanza_state()
        if global_state['active']:
            partner = global_state['partner']
            await self.send(text_data=json.dumps({
                'type':
                'swapanza.activate',
                'started_at':
                global_state['started_at'].isoformat(),
                'ends_at':
                global_state['ends_at'].isoformat(),
                'partner_id':
                partner.id,
                'partner_username':
                partner.username,
                'partner_profile_image':
                partner.profile_image_url
                if hasattr(partner, 'profile_image_url') else None,
                'message_count':
                global_state['message_count'],
                'remaining_messages':
                global_state['remaining_messages']
            }))

        
        await self.check_active_swapanza()

    async def disconnect(self, close_code):
        logger.info(f"WebSocket DISCONNECT: User {getattr(self.user, 'username', 'anonymous')} (ID: {getattr(self.user, 'id', 'none')}) from chat {self.chat_id} with code {close_code}")
        
        await self.channel_layer.group_discard(self.chat_group_name,
                                               self.channel_name)

        
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(self.user_group_name,
                                                   self.channel_name)

        
        await self.clear_pending_swapanza_request()

    
    async def receive(self, text_data):
        try:
            print(f"WEBSOCKET RECEIVE: {text_data}")  # This should always show up!
            data = json.loads(text_data)
            message_type = data.get('type', '')
            logger.info(f"WebSocket MESSAGE received from user {self.user.username} (ID: {self.user.id}) in chat {self.chat_id}: Type='{message_type}', Data={data}")

            if message_type == 'chat.message':
                logger.info(f"Processing chat message from {self.user.username}")
                content = data.get('content', '').strip()
                client_id = data.get('client_id')
                if not content:
                    return

                
                message_data = await self.save_chat_message(content)
                if client_id:
                    message_data['client_id'] = client_id

                
                if message_data.get('error'):
                    
                    await self.send(
                        text_data=json.dumps({
                            'type': 'chat.message.error',
                            'message': message_data['message'],
                            'content': message_data['content'],
                            'client_id': client_id
                        }))
                    return

                
                # Send notification to all other participants with actual unread count
                chat = await database_sync_to_async(Chat.objects.get)(id=self.chat_id)
                participants = await database_sync_to_async(lambda: list(chat.participants.exclude(id=self.user.id)) )()
                channel_layer = get_channel_layer()
                for recipient in participants:
                    # Calculate actual unread count for this recipient
                    from .models import Message
                    unread_count = await database_sync_to_async(lambda: Message.objects.filter(chat=chat).exclude(read_by=recipient).exclude(sender=recipient).count())()
                    await channel_layer.group_send(
                        f'user_{recipient.id}',
                        {
                            'type': 'notify',
                            'data': {
                                'type': 'unread_count',
                                'chat_id': chat.id,
                                'count': unread_count
                            }
                        }
                    )

                await self.channel_layer.group_send(self.chat_group_name, {
                    'type': 'chat_message',
                    'message': message_data
                })

            elif message_type == 'swapanza.request':
                logger.info(f"Processing Swapanza request from {self.user.username} (ID: {self.user.id})")
                duration = data.get('duration', 5)
                logger.info(f"Swapanza duration requested: {duration} minutes")
                success, message = await self.create_swapanza_request(duration)

                if not success:
                    logger.error(f"Swapanza request failed: {message}")
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': message
                    }))
                    return

                logger.info(f"Swapanza request successful, notifying participants")
                
                # Notify all other participants of the Swapanza invite
                chat = await database_sync_to_async(Chat.objects.get)(id=self.chat_id)
                participants = await database_sync_to_async(lambda: list(chat.participants.exclude(id=self.user.id)) )()
                channel_layer = get_channel_layer()
                for recipient in participants:
                    await channel_layer.group_send(
                        f'user_{recipient.id}',
                        {
                            'type': 'notify',
                            'data': {
                                'type': 'swapanza_invite',
                                'chat_id': chat.id,
                                'from': self.user.username
                            }
                        }
                    )

                await self.channel_layer.group_send(
                    self.chat_group_name, {
                        'type': 'swapanza_request',
                        'requested_by': self.user.id,
                        'requested_by_username': self.user.username,
                        'duration': duration
                    })

            elif message_type == 'swapanza.confirm':
                print(f"📨 PROCESSING CONFIRMATION: Swapanza confirmation from {self.user.username} (ID: {self.user.id})")
                logger.info(f"Processing Swapanza confirmation from {self.user.username} (ID: {self.user.id})")
                success, message, all_confirmed = await self.confirm_swapanza()

                print(f"🔄 CONFIRMATION RESULT: success={success}, message='{message}', all_confirmed={all_confirmed}")

                if not success:
                    print(f"❌ CONFIRMATION FAILED: {message}")
                    logger.error(f"Swapanza confirmation failed: {message}")
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': message
                    }))
                    return

                print(f"📡 SENDING GROUP MESSAGE: Broadcasting confirmation to chat group")
                await self.channel_layer.group_send(
                    self.chat_group_name, {
                        'type': 'swapanza_confirm',
                        'user_id': self.user.id,
                        'username': self.user.username,
                        'all_confirmed': all_confirmed
                    })

                # If all confirmed, activate Swapanza
                if all_confirmed:
                    print(f"🎉 ALL CONFIRMED: All users confirmed for chat {self.chat_id}, activating Swapanza after 2 second delay")
                    logger.info(f"All users confirmed for chat {self.chat_id}, activating Swapanza after 2 second delay")
                    await asyncio.sleep(2)  # Brief delay for UI
                    success, message, data = await self.activate_swapanza()

                    if success:
                        logger.info(f"Swapanza activated successfully for chat {self.chat_id}")
                        await self.channel_layer.group_send(
                            self.chat_group_name, {
                                'type': 'swapanza_activate',
                                'started_at': data['started_at'].isoformat(),
                                'ends_at': data['ends_at'].isoformat(),
                                'partner_id': data['partner_id'],
                                'partner_username': data['partner_username'],
                                'partner_profile_image': data.get('partner_profile_image')
                            })
                    else:
                        logger.error(f"Failed to activate Swapanza for chat {self.chat_id}: {message}")
                        await self.send(text_data=json.dumps({
                            'type': 'error',
                            'message': message
                        }))

            elif message_type == 'swapanza.cancel':
                # User requested to cancel their pending Swapanza invite
                try:
                    cleared = await self.cancel_swapanza_request()
                    if cleared:
                        # Notify chat group that the swapanza was cancelled
                        await self.channel_layer.group_send(
                            self.chat_group_name,
                            {
                                'type': 'swapanza_cancel',
                                'cancelled_by': self.user.id,
                                'cancelled_by_username': self.user.username,
                            }
                        )

                        # Also notify other participants via their notification channels to clear any invite markers
                        chat = await database_sync_to_async(Chat.objects.get)(id=self.chat_id)
                        participants = await database_sync_to_async(lambda: list(chat.participants.exclude(id=self.user.id)) )()
                        channel_layer = get_channel_layer()
                        for recipient in participants:
                            await channel_layer.group_send(
                                f'user_{recipient.id}',
                                {
                                    'type': 'notify',
                                    'data': {
                                        'type': 'swapanza_cancel',
                                        'chat_id': chat.id,
                                        'from': self.user.username
                                    }
                                }
                            )
                    else:
                        await self.send(text_data=json.dumps({'type': 'error', 'message': 'No pending swapanza to cancel or not permitted.'}))
                except Exception as e:
                    logger.error(f"Error handling swapanza.cancel: {e}\n{traceback.format_exc()}")
                    await self.send(text_data=json.dumps({'type': 'error', 'message': 'Server error while cancelling swapanza'}))
            
            else:
                logger.warning(f"Unrecognized message type '{message_type}' from user {self.user.username} (ID: {self.user.id}) in chat {self.chat_id}")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unrecognized message type: {message_type}'
                }))

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            logger.error(traceback.format_exc())
            await self.send(
                text_data=json.dumps({
                    'type': 'error',
                    'message': 'Server error: ' + str(e)
                }))

    
    @database_sync_to_async
    def get_global_swapanza_state(self):
        """Get the user's global Swapanza state across all chats"""
        user = self.user
        now = timezone.now()
        chat_id = self.chat_id

        
        active_session = SwapanzaSession.objects.filter(
            user=user, active=True, ends_at__gt=now).first()

        if not active_session:
            return {'active': False}

        
        
        if active_session.chat:
            chat = active_session.chat
            
            if int(self.chat_id) != chat.id:
                
                current_chat = Chat.objects.get(id=self.chat_id)
                chat_message_counts = current_chat.swapanza_message_count or {}
                message_count = chat_message_counts.get(str(user.id), 0)
            else:
                
                chat_message_counts = chat.swapanza_message_count or {}
                message_count = chat_message_counts.get(str(user.id), 0)
        else:
            
            message_count = Message.objects.filter(
                sender=user,
                chat_id=chat_id,
                during_swapanza=True,
                created_at__gte=active_session.started_at).count()

        return {
            'active': True,
            'partner': active_session.partner,
            'started_at': active_session.started_at,
            'ends_at': active_session.ends_at,
            'message_count': message_count,
            'remaining_messages': max(0, 2 - message_count),
            'chat_id': active_session.chat.id if active_session.chat else None
        }

    
    @database_sync_to_async
    def save_chat_message(self, content):
        """Save a chat message to the database with Swapanza validation"""
        user = self.user
        chat = Chat.objects.get(id=self.chat_id)
        now = timezone.now()

        
        active_session = SwapanzaSession.objects.filter(
            user=user, active=True, ends_at__gt=now).first()

        
        during_swapanza = active_session is not None
        apparent_sender = None
        apparent_sender_username = None
        apparent_sender_profile_image = None
        remaining_messages = 0  

        
        if during_swapanza:
            
            
            chat_messages_sent = Message.objects.filter(
                sender=user,
                chat=chat,  
                during_swapanza=True,
                created_at__gte=active_session.started_at).count()

            
            if chat_messages_sent >= 2:
                return {
                    'error': True,
                    'message':
                    "You have reached your message limit for this chat during Swapanza",
                    'content': content
                }

            
            if len(content) > 7:
                return {
                    'error': True,
                    'message':
                    "During Swapanza, messages must be 7 characters or less",
                    'content': content
                }

            if ' ' in content:
                return {
                    'error': True,
                    'message':
                    "During Swapanza, spaces are not allowed in messages",
                    'content': content
                }

            
            apparent_sender = active_session.partner

            
            
            apparent_sender_username = apparent_sender.username

            
            if hasattr(
                    apparent_sender,
                    'profile_image_url') and apparent_sender.profile_image_url:
                apparent_sender_profile_image = apparent_sender.profile_image_url
            elif hasattr(apparent_sender, 'profile') and hasattr(
                    apparent_sender.profile, 'profile_image_url'
            ) and apparent_sender.profile.profile_image_url:
                apparent_sender_profile_image = apparent_sender.profile.profile_image_url
            else:
                apparent_sender_profile_image = ""  

        
        message = Message.objects.create(
            sender=user,
            chat=chat,
            content=content,
            during_swapanza=during_swapanza,
            apparent_sender=apparent_sender,
            apparent_sender_username=apparent_sender_username,
            apparent_sender_profile_image=apparent_sender_profile_image)

        
        if during_swapanza:
            
            actual_message_count = chat_messages_sent + 1  
            remaining_messages = max(0, 2 - actual_message_count)

            
            
            chat.refresh_from_db(fields=['swapanza_message_count'])
            chat_message_counts = chat.swapanza_message_count or {}
            user_id_str = str(user.id)

            
            chat_message_counts[user_id_str] = actual_message_count
            chat.swapanza_message_count = chat_message_counts
            chat.save(update_fields=['swapanza_message_count'])

        
        result = {
            'id': message.id,
            'sender': user.id,
            'content': content,
            'created_at': message.created_at.isoformat(),
            'during_swapanza': during_swapanza,
            'apparent_sender': apparent_sender.id if apparent_sender else None,
            'remaining_messages': remaining_messages,
            'apparent_sender_username': apparent_sender_username,
            'apparent_sender_profile_image': apparent_sender_profile_image
        }

        return result

    
    @database_sync_to_async
    def check_active_swapanza(self):
        """Check if the current chat has an active Swapanza and notify client"""
        chat = Chat.objects.get(id=self.chat_id)
        now = timezone.now()
        user = self.user

        
        if chat.swapanza_active and chat.swapanza_ends_at and chat.swapanza_ends_at > now:
            
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

            
            chat_message_counts = chat.swapanza_message_count or {}
            user_id_str = str(self.user.id)

            
            if user_id_str not in chat_message_counts:
                chat_message_counts[user_id_str] = 0
                chat.swapanza_message_count = chat_message_counts
                chat.save(update_fields=['swapanza_message_count'])
                current_count = 0
            else:
                current_count = chat_message_counts.get(user_id_str, 0)

            
            remaining_messages = max(0, 2 - current_count)

            
            logger.info(
                f"Active Swapanza in chat {chat.id} - user {user_id_str} has {current_count} messages, {remaining_messages} remaining"
            )

            
            return self.send(text_data=json.dumps({
                'type':
                'swapanza.activate',
                'started_at':
                chat.swapanza_started_at.isoformat(),
                'ends_at':
                chat.swapanza_ends_at.isoformat(),
                'partner_id':
                other_participant.id,
                'partner_username':
                other_participant.username,
                'partner_profile_image':
                other_participant.profile_image_url if hasattr(
                    other_participant, 'profile_image_url') else None,
                'remaining_messages':
                remaining_messages
            }))
        else:
            
            active_session = SwapanzaSession.objects.filter(
                user=self.user, active=True, ends_at__gt=now).first()

            if active_session and active_session.chat_id != int(self.chat_id):
                
                
                actual_message_count = Message.objects.filter(
                    sender=user,
                    chat_id=self.chat_id,  
                    during_swapanza=True,
                    created_at__gte=active_session.started_at).count()

                
                chat_message_counts = chat.swapanza_message_count or {}
                user_id_str = str(self.user.id)

                
                
                if actual_message_count == 0:
                    
                    remaining_messages = 2
                else:
                    
                    remaining_messages = max(0, 2 - actual_message_count)

                
                if user_id_str not in chat_message_counts or chat_message_counts[
                        user_id_str] != actual_message_count:
                    chat_message_counts[user_id_str] = actual_message_count
                    chat.swapanza_message_count = chat_message_counts
                    chat.save(update_fields=['swapanza_message_count'])

                logger.info(
                    f"Global Swapanza active - user {user.id} has {actual_message_count} messages in chat {self.chat_id}, SHOWING {remaining_messages} remaining"
                )

                
                return self.send(text_data=json.dumps({
                    'type':
                    'swapanza.activate',
                    'started_at':
                    active_session.started_at.isoformat(),
                    'ends_at':
                    active_session.ends_at.isoformat(),
                    'partner_id':
                    active_session.partner.id,
                    'partner_username':
                    active_session.partner.username,
                    'partner_profile_image':
                    active_session.partner.profile_image_url if hasattr(
                        active_session.partner, 'profile_image_url') else None,
                    'remaining_messages':
                    remaining_messages  
                }))

    
    @database_sync_to_async
    def create_swapanza_request(self, duration):
        """Create a Swapanza request for the current chat"""
        try:
            chat = Chat.objects.get(id=self.chat_id)

            
            if chat.swapanza_active and chat.swapanza_ends_at and chat.swapanza_ends_at > timezone.now(
            ):
                return False, "A Swapanza is already active in this chat"

            
            if chat.swapanza_requested_by:
                
                if chat.swapanza_requested_at:
                    two_minutes_ago = timezone.now() - timezone.timedelta(
                        minutes=2)
                    if chat.swapanza_requested_at < two_minutes_ago:
                        logger.info(
                            f"Clearing stale Swapanza request from {chat.swapanza_requested_by.username}")
                        chat.swapanza_requested_by = None
                        chat.swapanza_confirmed_users = []
                        
                    else:
                        
                        
                        if chat.swapanza_requested_by.id != self.user.id:
                            return False, f"A Swapanza request by {chat.swapanza_requested_by.username} is already pending. Please wait for it to expire or ask them to withdraw their request."
                        
                        else:
                            return False, "You already have a pending Swapanza request in this chat"
                else:
                    
                    
                    chat.swapanza_requested_by = None
                    chat.swapanza_confirmed_users = []

            
            participants = list(chat.participants.all())
            active_sessions = SwapanzaSession.objects.filter(
                user__in=participants, active=True, ends_at__gt=timezone.now())

            if active_sessions.exists():
                
                active_users = set(
                    active_sessions.values_list('user__username', flat=True))
                users_str = ", ".join(active_users)
                return False, f"Cannot start Swapanza: {users_str} already have active Swapanza sessions"

            
            # Set up the Swapanza request
            print(f"SETTING SWAPANZA REQUEST: User {self.user.username} requesting in chat {self.chat_id}")
            chat.swapanza_requested_by = self.user  
            chat.swapanza_duration = duration
            # Initialize confirmed_users with the requester's ID (they're auto-confirmed)
            chat.swapanza_confirmed_users = [str(self.user.id)]  
            print(f"🔧 PRE-SAVE DEBUG: Setting confirmed_users to [{str(self.user.id)}] for user {self.user.username} (ID: {self.user.id})")
            chat.swapanza_requested_at = timezone.now()  
            chat.save(update_fields=[
                'swapanza_requested_by', 'swapanza_duration',
                'swapanza_confirmed_users', 'swapanza_requested_at'
            ])
            # Verify the save actually worked
            chat.refresh_from_db()
            print(f"🔍 POST-SAVE CHECK: Database now shows confirmed_users={chat.swapanza_confirmed_users}")
            print(f"✅ SWAPANZA REQUEST SAVED: Chat {self.chat_id} now has request by {chat.swapanza_requested_by.username} at {chat.swapanza_requested_at} with confirmed_users={chat.swapanza_confirmed_users}")

            return True, None
        except Exception as e:
            logger.error(f"Error creating Swapanza request: {str(e)}")
            logger.error(traceback.format_exc())
            return False, str(e)

    
    @database_sync_to_async
    def confirm_swapanza(self):
        """Confirm user's participation in a Swapanza"""
        try:
            chat = Chat.objects.get(id=self.chat_id)
            
            # Debug logging
            print(f"🔍 CONFIRM SWAPANZA CALLED: User {self.user.username} (ID: {self.user.id}) attempting to confirm in chat {self.chat_id}")
            print(f"🔍 CHAT STATE: requested_by={chat.swapanza_requested_by}, requested_at={chat.swapanza_requested_at}, confirmed_users={chat.swapanza_confirmed_users}")
            logger.info(f"User {self.user.username} (ID: {self.user.id}) attempting to confirm Swapanza in chat {self.chat_id}")

            # Check if there's an active invitation to confirm
            if not chat.swapanza_requested_by:
                print(f"❌ NO ACTIVE INVITATION: Chat {self.chat_id} has no swapanza_requested_by")
                logger.warning(f"No active Swapanza invitation found in chat {self.chat_id}")
                return False, "No active Swapanza invitation found", False

            logger.info(f"Active Swapanza request by {chat.swapanza_requested_by.username} found")

            print(f"🔍 BEFORE CONFIRMED USERS: About to get confirmed users list")
            # Get current confirmed users
            try:
                confirmed_users = chat.swapanza_confirmed_users or []
                print(f"📝 CONFIRMED USERS: Current confirmed users: {confirmed_users}")
            except Exception as e:
                print(f"❌ ERROR GETTING CONFIRMED USERS: {str(e)}")
                logger.error(f"Error getting confirmed users: {str(e)}")
                return False, f"Error getting confirmed users: {str(e)}", False
            logger.info(f"Current confirmed users: {confirmed_users}")

            # Check if already confirmed
            if str(self.user.id) in confirmed_users:
                print(f"✅ ALREADY CONFIRMED: User {self.user.username} already confirmed")
                logger.info(f"User {self.user.username} already confirmed")
                return True, "Already confirmed", False

            # Add user to confirmed list
            confirmed_users.append(str(self.user.id))
            chat.swapanza_confirmed_users = confirmed_users
            chat.save(update_fields=['swapanza_confirmed_users'])
            
            print(f"💾 SAVED CONFIRMATION: Updated confirmed users: {confirmed_users}")
            logger.info(f"Updated confirmed users: {confirmed_users}")

            # Check if all participants confirmed
            participants = list(chat.participants.all())
            participant_ids = [str(p.id) for p in participants]
            all_confirmed = len(confirmed_users) == len(participants)
            
            print(f"👥 PARTICIPANTS: {[p.username for p in participants]} (IDs: {participant_ids})")
            print(f"🎯 ALL CONFIRMED CHECK: {all_confirmed} ({len(confirmed_users)}/{len(participants)})")
            logger.info(f"Participants: {[p.username for p in participants]} (IDs: {participant_ids})")
            logger.info(f"All confirmed: {all_confirmed} ({len(confirmed_users)}/{len(participants)})")

            return True, "Confirmation successful", all_confirmed
        except Exception as e:
            logger.error(f"Error confirming Swapanza: {str(e)}")
            logger.error(traceback.format_exc())
            return False, str(e), False

    
    @database_sync_to_async
    def activate_swapanza(self):
        """Activate Swapanza after all participants have confirmed"""
        try:
            with transaction.atomic():
                chat = Chat.objects.get(id=self.chat_id)
                
                logger.info(f"Attempting to activate Swapanza for chat {self.chat_id}")

                # Verify request exists
                if not chat.swapanza_requested_by:
                    logger.error(f"No Swapanza request exists for chat {self.chat_id}")
                    return False, "No Swapanza request exists", None

                # Check all participants confirmed
                participants = list(chat.participants.all())
                confirmed_users = chat.swapanza_confirmed_users or []
                
                logger.info(f"Participants: {[p.username for p in participants]} (count: {len(participants)})")
                logger.info(f"Confirmed users: {confirmed_users} (count: {len(confirmed_users)})")
                
                if len(confirmed_users) != len(participants):
                    logger.error(f"Not all participants confirmed: {len(confirmed_users)}/{len(participants)}")
                    return False, "Not all participants have confirmed", None

                # Create timing
                duration = chat.swapanza_duration or 5
                start_time = timezone.now()
                end_time = start_time + timezone.timedelta(minutes=duration)
                
                logger.info(f"Creating Swapanza session: {duration} minutes from {start_time} to {end_time}")

                # Activate chat Swapanza state
                chat.swapanza_active = True
                chat.swapanza_started_at = start_time
                chat.swapanza_ends_at = end_time
                chat.swapanza_message_count = {}
                chat.save(update_fields=[
                    'swapanza_active', 'swapanza_started_at',
                    'swapanza_ends_at', 'swapanza_message_count'
                ])

                # Deactivate any existing sessions
                SwapanzaSession.objects.filter(
                    user__in=participants, active=True).update(active=False)

                # Create Swapanza sessions for each user-partner pair
                created_sessions = []
                for i, user1 in enumerate(participants):
                    for j, user2 in enumerate(participants):
                        if i != j:  # Don't pair user with themselves
                            logger.info(f"Creating session: {user1.username} as {user2.username}")
                            session = SwapanzaSession.objects.create(
                                user=user1,
                                partner=user2,
                                chat=chat,
                                started_at=start_time,
                                ends_at=end_time,
                                active=True,
                                message_count=0
                            )
                            created_sessions.append(session)

                logger.info(f"Created {len(created_sessions)} Swapanza sessions")

                # Find current user's session for return data
                current_user_session = next(
                    (s for s in created_sessions if s.user.id == self.user.id),
                    None)

                if not current_user_session:
                    logger.error(f"Could not find session for current user {self.user.username}")
                    return False, "Could not create Swapanza session for current user", None

                partner = current_user_session.partner
                logger.info(f"Current user {self.user.username} will appear as {partner.username}")

                return True, "Swapanza activated successfully", {
                    'started_at': start_time,
                    'ends_at': end_time,
                    'partner_id': partner.id,
                    'partner_username': partner.username,
                    'partner_profile_image': partner.profile_image_url if hasattr(partner, 'profile_image_url') else None,
                    'remaining_messages': 2
                }
        except Exception as e:
            logger.error(f"Error activating Swapanza: {str(e)}")
            logger.error(traceback.format_exc())
            return False, str(e), None

    async def chat_message(self, event):
        """Send chat message to WebSocket"""
        message = event['message']

        
        data_to_send = {
            'type': 'chat.message',
        }

        
        for key, value in message.items():
            data_to_send[key] = value

        
        if message.get('during_swapanza') and message.get('apparent_sender'):
            
            try:
                apparent_sender_id = message.get('apparent_sender')

                
                apparent_sender = await sync_to_async(User.objects.get)(id=apparent_sender_id)
                data_to_send[
                    'apparent_sender_username'] = apparent_sender.username

                
                if hasattr(apparent_sender, 'profile_image_url'
                           ) and apparent_sender.profile_image_url:
                    data_to_send[
                        'apparent_sender_profile_image'] = apparent_sender.profile_image_url
                elif hasattr(apparent_sender, 'profile') and hasattr(
                        apparent_sender.profile, 'profile_image_url'
                ) and apparent_sender.profile.profile_image_url:
                    data_to_send[
                        'apparent_sender_profile_image'] = apparent_sender.profile.profile_image_url
                else:
                    data_to_send[
                        'apparent_sender_profile_image'] = ""  
            except Exception as e:
                logger.error(f"Error getting apparent sender info: {str(e)}")

        await self.send(text_data=json.dumps(data_to_send))

    async def messages_read(self, event):
        """Notify WebSocket that messages have been read"""
        await self.send(text_data=json.dumps({
            'type': 'chat.messages_read',
            'user_id': event['user_id']
        }))

    async def swapanza_request(self, event):
        """Send Swapanza request to WebSocket"""
        await self.send(text_data=json.dumps(
            {
                'type': 'swapanza.request',
                'requested_by': event['requested_by'],
                'requested_by_username': event['requested_by_username'],
                'duration': event['duration']
            }))

    async def swapanza_confirm(self, event):
        """Send Swapanza confirmation to WebSocket"""
        await self.send(
            text_data=json.dumps({
                'type': 'swapanza.confirm',
                'user_id': event['user_id'],
                'username': event['username'],
                'all_confirmed': event['all_confirmed']
            }))

    async def swapanza_activate(self, event):
        """Send Swapanza activation to WebSocket"""
        
        await self.send(text_data=json.dumps(
            {
                'type': 'swapanza.activate',
                'started_at': event['started_at'],
                'ends_at': event['ends_at'],
                'partner_id': event['partner_id'],
                'partner_username': event['partner_username'],
                'partner_profile_image': event.get('partner_profile_image'),
                'remaining_messages':
                2  
            }))

    async def swapanza_expire(self, event):
        """Notify WebSocket that Swapanza has expired"""
        await self.send(text_data=json.dumps({
            'type': 'swapanza.expire',
            'force_redirect': True
        }))

        
        await self.deactivate_swapanza_sessions()

    async def swapanza_cancel(self, event):
        """Notify clients that a Swapanza invite was cancelled by the requester"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'swapanza.cancel',
                'cancelled_by': event.get('cancelled_by'),
                'cancelled_by_username': event.get('cancelled_by_username')
            }))

            # Ensure any active sessions are deactivated and pending invites cleared where appropriate
            await self.deactivate_swapanza_sessions()
        except Exception as e:
            logger.error(f"Error sending swapanza_cancel to client: {e}")

    async def swapanza_logout(self, event):
        """Send Swapanza logout notification to WebSocket"""
        
        if self.scope['session'].get('already_logging_out'):
            
            return

        
        self.scope['session']['already_logging_out'] = True

        
        await self.send(text_data=json.dumps({
            'type': 'swapanza.logout',
            'force_redirect':
            True  
        }))

        
        await self.close(code=4000
                         )  

    @database_sync_to_async
    def deactivate_swapanza_sessions(self):
        """Deactivate all Swapanza sessions for this chat and clear pending invites"""
        try:
            chat = Chat.objects.get(id=self.chat_id)

            # Always deactivate all sessions for all participants
            participants = list(chat.participants.all())
            SwapanzaSession.objects.filter(user__in=participants,
                                         chat=chat,
                                         active=True).update(active=False)

            # Always reset ALL Swapanza state
            chat.swapanza_active = False
            chat.swapanza_requested_by = None
            chat.swapanza_requested_at = None
            chat.swapanza_confirmed_users = []
            chat.swapanza_duration = None
            chat.swapanza_started_at = None
            chat.swapanza_ends_at = None
            chat.swapanza_message_count = {}
            
            update_fields = [
                'swapanza_active',
                'swapanza_requested_by',
                'swapanza_requested_at',
                'swapanza_confirmed_users',
                'swapanza_duration',
                'swapanza_started_at',
                'swapanza_ends_at',
                'swapanza_message_count'
            ]
            chat.save(update_fields=update_fields)

            logger.info(f"Deactivated Swapanza sessions for chat {self.chat_id} (cleared pending invite if stale and not all confirmed)")
            return True
        except Exception as e:
            logger.error(f"Error deactivating Swapanza sessions: {str(e)}")
            return False

    @database_sync_to_async
    def mark_messages_as_seen_async(self):
        """Mark all messages in the chat as seen by the current user"""
        try:
            chat = Chat.objects.get(id=self.chat_id)

            
            unread_messages = Message.objects.filter(chat=chat).exclude(
                read_by=self.user).exclude(sender=self.user)

            
            updated_count = 0
            for message in unread_messages:
                message.read_by.add(self.user)
                updated_count += 1

            logger.info(
                f"Marked {updated_count} messages as read in chat {self.chat_id}"
            )
            return updated_count
        except Exception as e:
            logger.error(f"Error marking messages as read: {str(e)}")
            return 0

    @database_sync_to_async
    def get_active_swapanza_session(self):
        """Get the user's active Swapanza session in this chat if any"""
        try:
            return SwapanzaSession.objects.filter(
                user=self.user,
                chat_id=self.chat_id,
                active=True,
                ends_at__gt=timezone.now()).first()
        except Exception as e:
            logger.error(f"Error getting active Swapanza session: {str(e)}")
            return None

    @database_sync_to_async
    def update_chat_with_swapanza_request(self, duration):
        """Update chat with Swapanza request info"""
        chat = Chat.objects.get(id=self.chat_id)

        
        if not chat.swapanza_active:
            chat.swapanza_requested_by = self.user
            chat.swapanza_duration = duration
            chat.swapanza_confirmed_users = []
            chat.save(update_fields=[
                'swapanza_requested_by', 'swapanza_duration',
                'swapanza_confirmed_users'
            ])

        return chat

    @database_sync_to_async
    def create_swapanza_sessions(self, start_time, end_time):
        """Create Swapanza sessions in a transaction"""
        try:
            with transaction.atomic():
                chat = Chat.objects.get(id=self.chat_id)

                
                if chat.swapanza_active and chat.swapanza_ends_at and chat.swapanza_ends_at > timezone.now(
                ):
                    return False, "A Swapanza is already active in this chat"

                participants = list(chat.participants.all())

                if len(participants) < 2:
                    raise ValueError(
                        "Need at least 2 participants for Swapanza")

                
                active_sessions = SwapanzaSession.objects.filter(
                    user__in=participants,
                    active=True,
                    ends_at__gt=timezone.now()).exclude(chat=chat)

                if active_sessions.exists():
                    
                    active_users = active_sessions.values_list(
                        'user__username', flat=True)
                    return False, f"Cannot start Swapanza: {', '.join(active_users)} already have active Swapanza sessions"

                
                SwapanzaSession.objects.filter(
                    chat=chat, active=True).update(active=False)

                
                user1, user2 = participants[:2]
                SwapanzaSession.objects.create(user=user1,
                                               partner=user2,
                                               started_at=start_time,
                                               ends_at=end_time,
                                               active=True,
                                               message_count=0,
                                               chat=chat)
                SwapanzaSession.objects.create(user=user2,
                                               partner=user1,
                                               started_at=start_time,
                                               ends_at=end_time,
                                               active=True,
                                               message_count=0,
                                               chat=chat)

                
                chat.swapanza_active = True
                chat.swapanza_started_at = start_time
                chat.swapanza_ends_at = end_time
                chat.swapanza_message_count = {}
                chat.save(update_fields=[
                    'swapanza_active', 'swapanza_started_at',
                    'swapanza_ends_at', 'swapanza_message_count'
                ])

            return True, None
        except Exception as e:
            logger.error(f"Error creating Swapanza sessions: {str(e)}")
            logger.error(traceback.format_exc())  
            return False, str(e)

    @database_sync_to_async
    def can_start_swapanza(self):
        """Check if user can start or join a Swapanza"""
        from django.db.models import Q

        user = self.user
        now = timezone.now()

        
        active_session = SwapanzaSession.objects.filter(
            Q(user=user) | Q(partner=user), active=True,
            ends_at__gt=now).first()

        if active_session:
            if active_session.chat_id == int(self.chat_id):
                
                return True, None
            return False, f"You already have an active Swapanza in chat with {active_session.partner.username}"

        
        active_chat = Chat.objects.filter(
            participants=user, swapanza_active=True,
            swapanza_ends_at__gt=now).exclude(id=self.chat_id).first()

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

        
        participants = list(chat.participants.values_list('id', flat=True))
        all_confirmed = all(
            str(uid) in confirmed_users for uid in participants)

        return all_confirmed, confirmed_users, len(participants)

    @database_sync_to_async
    def cancel_swapanza_request(self):
        """Cancel a pending Swapanza request for this chat and clear all related state."""
        try:
            chat = Chat.objects.get(id=self.chat_id)
            participants = [user.id for user in chat.participants.all()]
            
            if self.user.id not in participants:
                return False
                
            # Clear ALL Swapanza state completely (not just pending requests)
            instance_updated = False
            
            if chat.swapanza_requested_by:
                chat.swapanza_requested_by = None
                instance_updated = True
                
            if chat.swapanza_confirmed_users:
                chat.swapanza_confirmed_users = []
                instance_updated = True
                
            if chat.swapanza_requested_at:
                chat.swapanza_requested_at = None
                instance_updated = True
                
            if chat.swapanza_duration:
                chat.swapanza_duration = None
                instance_updated = True
            
            # Also clear any active Swapanza if it exists (in case of corruption)
            if chat.swapanza_active:
                chat.swapanza_active = False
                chat.swapanza_started_at = None
                chat.swapanza_ends_at = None
                chat.swapanza_message_count = {}
                instance_updated = True
                
                # Deactivate any active sessions
                SwapanzaSession.objects.filter(
                    chat=chat, 
                    active=True
                ).update(active=False)
            
            if instance_updated:
                chat.save(update_fields=[
                    'swapanza_requested_by', 'swapanza_confirmed_users', 
                    'swapanza_requested_at', 'swapanza_duration',
                    'swapanza_active', 'swapanza_started_at', 
                    'swapanza_ends_at', 'swapanza_message_count'
                ])
                logger.info(f"Cleared all Swapanza state for chat {self.chat_id} by user {self.user.username}")
                return True
            
            return False
        except Exception as e:
            logger.error(f"Error canceling Swapanza request: {str(e)}")
            return False

    @database_sync_to_async
    def clear_pending_swapanza_request(self):
        """Clear any pending Swapanza request for this chat when a user disconnects (only for requests they made)"""
        try:
            chat = Chat.objects.get(id=self.chat_id)

            # Only clear if current user was the requester (to avoid clearing others' requests on disconnect)
            if (chat.swapanza_requested_by and 
                chat.swapanza_requested_by.id == self.user.id and 
                not chat.swapanza_active):
                
                logger.info(f"Clearing pending Swapanza request from {self.user.username} in chat {self.chat_id}")
                chat.swapanza_requested_by = None
                chat.swapanza_confirmed_users = []
                chat.swapanza_requested_at = None
                chat.swapanza_duration = None
                chat.save(update_fields=[
                    'swapanza_requested_by', 'swapanza_confirmed_users', 
                    'swapanza_requested_at', 'swapanza_duration'
                ])
                return True

            return False
        except Exception as e:
            logger.error(f"Error clearing pending Swapanza request: {str(e)}")
            return False



class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        import logging
        logger = logging.getLogger(__name__)
        self.user = await self.get_user_from_token()
        if not self.user or not self.user.is_authenticated:
            logger.warning(f"NotificationConsumer: user not authenticated, closing. user={self.user}")
            await self.close()
            return
        logger.info(f"NotificationConsumer: user {self.user} authenticated, accepting connection.")
        self.group_name = f'user_{self.user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        logger = logging.getLogger(__name__)
        try:
            logger.info(f"NotificationConsumer: disconnect called for user={getattr(self, 'user', None)} with code={code}")
            if hasattr(self, 'group_name'):
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
        except Exception as e:
            logger.error(f"Error during disconnect: {e}\n{traceback.format_exc()}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get("type") == "ping":
                logger.info("NotificationConsumer: received ping, sending pong")
                await self.send(text_data=json.dumps({"type": "pong"}))
                logger.info("NotificationConsumer: sent pong")
                return
            # Handle ping/pong for keepalive
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except Exception as e:
            logger.error(f"Exception in NotificationConsumer.receive: {e}\n{traceback.format_exc()}")
            pass

    async def notify(self, event):
        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def get_user_from_token(self):
        from urllib.parse import parse_qs
        query_string = self.scope.get('query_string', b'').decode()
        token = parse_qs(query_string).get('token', [None])[0]
        if not token:
            return AnonymousUser()
        try:
            access_token = AccessToken(token)
            return User.objects.get(id=access_token['user_id'])
        except Exception:
            return AnonymousUser()
