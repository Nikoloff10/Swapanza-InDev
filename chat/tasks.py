from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from celery import shared_task
from .models import Chat, SwapanzaSession  # Add SwapanzaSession import

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
    for session in expired_sessions:
        # Mark the session as inactive
        session.active = False
        session.save()
        
        # Notify user's active connections about expiration
        async_to_sync(channel_layer.group_send)(
            f'user_{session.user.id}',
            {
                'type': 'swapanza_expire',
            }
        )
        session_count += 1
    
    # Also check chat-specific Swapanza (legacy)
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
    
    return f"Reset {session_count} expired Swapanza sessions and {chat_count} chat Swapanzas"