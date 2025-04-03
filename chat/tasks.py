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
    
    session_count = 0
    affected_users = set()  # Track affected users to send notifications
    
    for session in expired_sessions:
        # Mark the session as inactive but preserve the during_swapanza flag on messages
        session.active = False
        session.save()
        
        # Add users to affected set
        affected_users.add(session.user.id)
        
        session_count += 1
    
    # Also check chat-specific Swapanza
    expired_chats = Chat.objects.filter(
        swapanza_active=True,
        swapanza_ends_at__lte=now
    )
    
    chat_count = 0
    for chat in expired_chats:
        # Reset chat Swapanza state but PRESERVE message_count for history
        chat.swapanza_active = False 
        chat.save(update_fields=['swapanza_active'])
        
        # Notify chat participants about expiration
        async_to_sync(channel_layer.group_send)(
            f'chat_{chat.id}',
            {
                'type': 'swapanza_expire',
            }
        )
        chat_count += 1
    
    # Send notifications to all affected users
    for user_id in affected_users:
        async_to_sync(channel_layer.group_send)(
            f'user_{user_id}',
            {
                'type': 'swapanza_expire',
            }
        )
    
    return f"Reset {session_count} expired Swapanza sessions and {chat_count} chat Swapanzas."


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