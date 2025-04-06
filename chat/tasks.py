from celery import shared_task
from django.utils import timezone
from .models import SwapanzaSession, Chat
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

@shared_task
def check_expired_swapanzas():
    """Check for expired Swapanzas and deactivate them"""
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
            print(f"[Swapanza Expiry] Deactivated session for user {session.user.username} in chat {session.chat_id if session.chat else 'None'}")
            session_count += 1
        except Exception as e:
            print(f"Error deactivating session: {str(e)}")
    
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
            
            print(f"[Swapanza Expiry] Deactivated Swapanza in chat {chat.id}")
            chat_count += 1
        except Exception as e:
            print(f"Error deactivating chat Swapanza: {str(e)}")
    
    # Send notifications to all affected chats - this notifies users in the chat
    for chat_id in affected_chats:
        try:
            async_to_sync(channel_layer.group_send)(
                f'chat_{chat_id}',
                {
                    'type': 'swapanza_expire',
                }
            )
            print(f"[Swapanza Expiry] Sent expire notification to chat {chat_id}")
        except Exception as e:
            print(f"Error sending expire notification to chat {chat_id}: {str(e)}")
    
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
            
            print(f"[Swapanza Expiry] Sent logout notification to user {user_id}")
        except Exception as e:
            print(f"Error sending logout notification to user {user_id}: {str(e)}")
    
    return f"Reset {session_count} expired Swapanza sessions and {chat_count} chat Swapanzas. Affected {len(affected_users)} users."


@shared_task
def cleanup_stale_swapanza_requests():
    """Clean up stale Swapanza requests"""
    two_minutes_ago = timezone.now() - timezone.timedelta(minutes=2)
    
    # Find chats with stale requests
    stale_chats = Chat.objects.filter(
        swapanza_requested_by__isnull=False,
        swapanza_active=False,  # Only non-active Swapanzas
        swapanza_requested_at__lt=two_minutes_ago
    )
    
    # Reset these requests
    count = stale_chats.count()
    if count > 0:
        print(f"Cleaning up {count} stale Swapanza requests")
        stale_chats.update(
            swapanza_requested_by=None,
            swapanza_confirmed_users=[]
        )
    
    return f"Cleaned up {count} stale Swapanza requests"