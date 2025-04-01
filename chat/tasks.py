from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.utils import timezone
from .models import Chat, SwapanzaSession


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
    affected_users = set()  # Track affected users to send logout notification
    
    for session in expired_sessions:
        # Mark the session as inactive
        session.active = False
        session.save()
        
        # Add users to affected set
        affected_users.add(session.user.id)
        affected_users.add(session.partner.id)
        
        session_count += 1
    
    # Also check chat-specific Swapanza
    expired_chats = Chat.objects.filter(
        swapanza_active=True,
        swapanza_ends_at__lte=now
    )
    
    chat_count = 0
    for chat in expired_chats:
        chat.reset_swapanza()
        
        # Notify chat participants about expiration
        async_to_sync(channel_layer.group_send)(
            f'chat_{chat.id}',
            {
                'type': 'swapanza_expire',
            }
        )
        chat_count += 1
    
    # Send logout notifications to all affected users
    for user_id in affected_users:
        async_to_sync(channel_layer.group_send)(
            f'user_{user_id}',
            {
                'type': 'swapanza_logout',
            }
        )
    
    return f"Reset {session_count} expired Swapanza sessions and {chat_count} chat Swapanzas. Sent logout notifications to {len(affected_users)} users."