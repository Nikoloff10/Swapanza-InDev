from celery import shared_task
from django.utils import timezone
from .models import SwapanzaSession, Chat
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging
logger = logging.getLogger(__name__)

@shared_task
def check_expired_swapanzas():
    """Check for expired Swapanzas and clean up stale invitations"""
    now = timezone.now()
    channel_layer = get_channel_layer()
    
    # Find all expired Swapanza sessions
    expired_sessions = SwapanzaSession.objects.filter(
        active=True,
        ends_at__lte=now
    )
    
    # Track affected users and chats
    affected_users = set()
    affected_chats = set()
    session_count = 0
    
    # Deactivate all expired sessions
    for session in expired_sessions:
        try:
            # Mark the session as inactive
            session.active = False
            session.save(update_fields=['active'])
            
            # Track affected users and chats
            affected_users.add(session.user.id)
            if session.chat:
                affected_chats.add(session.chat.id)
            
            # Log for debugging
            logger.info(f"[Swapanza Expiry] Deactivated session for user {session.user.username} in chat {session.chat_id if session.chat else 'None'}")
            session_count += 1
        except Exception as e:
            logger.error(f"Error deactivating session: {str(e)}")
    
    # Handle chat-specific Swapanza 
    expired_chats = Chat.objects.filter(
        swapanza_active=True,
        swapanza_ends_at__lte=now
    )
    
    chat_count = 0
    for chat in expired_chats:
        try:
            # Reset chat Swapanza state
            chat.swapanza_active = False
            chat.save(update_fields=['swapanza_active'])
            
            # Add to affected chats
            affected_chats.add(chat.id)
            
            # Add all participants to affected users
            for user_id in chat.participants.values_list('id', flat=True):
                affected_users.add(user_id)
            
            logger.info(f"[Swapanza Expiry] Deactivated Swapanza in chat {chat.id}")
            chat_count += 1
        except Exception as e:
            logger.error(f"Error deactivating chat Swapanza: {str(e)}")
    
    # NEW: Clean up stale pending invitations (older than 10 minutes)
    stale_threshold = now - timezone.timedelta(minutes=10)
    stale_invites = Chat.objects.filter(
        swapanza_requested_by__isnull=False,
        swapanza_requested_at__lt=stale_threshold,
        swapanza_active=False
    )
    
    stale_count = 0
    for chat in stale_invites:
        try:
            logger.info(f"[Stale Cleanup] Clearing stale invite in chat {chat.id} from {chat.swapanza_requested_by.username}")
            chat.swapanza_requested_by = None
            chat.swapanza_requested_at = None
            chat.swapanza_confirmed_users = []
            chat.swapanza_duration = None
            chat.save(update_fields=[
                'swapanza_requested_by', 'swapanza_requested_at', 
                'swapanza_confirmed_users', 'swapanza_duration'
            ])
            stale_count += 1
            
            # Notify chat participants that stale invite was cleaned up
            async_to_sync(channel_layer.group_send)(
                f'chat_{chat.id}',
                {
                    'type': 'swapanza_cancel',
                    'cancelled_by': None,  # System cleanup
                    'cancelled_by_username': 'System',
                }
            )
            
        except Exception as e:
            logger.error(f"Error clearing stale invite: {str(e)}")
    
    # Send notifications to all affected chats - this notifies users in the chat
    for chat_id in affected_chats:
        try:
            async_to_sync(channel_layer.group_send)(
                f'chat_{chat_id}',
                {
                    'type': 'swapanza_expire',
                }
            )
            logger.info(f"[Swapanza Expiry] Sent expire notification to chat {chat_id}")
        except Exception as e:
            logger.error(f"Error sending expire notification to chat {chat_id}: {str(e)}")
    
    # Send logout notifications to all affected users - CRITICAL: This must be sent to user's personal channels
    for user_id in affected_users:
        try:
            # First to user's personal channel
            user_channel = f'user_{user_id}'
            async_to_sync(channel_layer.group_send)(
                user_channel,
                {
                    'type': 'swapanza_logout',
                    'force_redirect': True
                }
            )
            
            # Also to any chat the user might be in
            for chat_id in affected_chats:
                async_to_sync(channel_layer.group_send)(
                    f'chat_{chat_id}',
                    {
                        'type': 'swapanza_logout',
                        'force_redirect': True,
                        'user_id': user_id
                    }
                )
            
            logger.info(f"[Swapanza Expiry] Sent logout notification to user {user_id}")
        except Exception as e:
            logger.error(f"Error sending logout notification to user {user_id}: {str(e)}")
    
    return f"Reset {session_count} expired sessions, {chat_count} chat Swapanzas, and {stale_count} stale invites. Affected {len(affected_users)} users."

