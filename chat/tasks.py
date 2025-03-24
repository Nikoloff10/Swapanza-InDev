from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from celery import shared_task
from .models import Chat

@shared_task
def check_expired_swapanzas():
    """Check for expired Swapanzas and deactivate them"""
    now = timezone.now()
    channel_layer = get_channel_layer()
    
    # Find all active Swapanzas that have expired
    expired_swapanzas = Chat.objects.filter(
        swapanza_active=True,
        swapanza_ends_at__lte=now
    )
    
    count = 0
    for chat in expired_swapanzas:
        # Reset Swapanza state
        chat.reset_swapanza()
        
        # Notify participants that Swapanza has ended
        async_to_sync(channel_layer.group_send)(
            f'chat_{chat.id}',
            {
                'type': 'swapanza_expire',
            }
        )
        count += 1
    
    return f"Reset {count} expired Swapanza sessions"