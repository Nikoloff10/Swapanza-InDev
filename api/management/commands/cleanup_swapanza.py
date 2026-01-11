from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import Chat, SwapanzaSession

class Command(BaseCommand):
    help = 'Clean up corrupted Swapanza state'

    def handle(self, *args, **options):
        self.stdout.write('Cleaning up corrupted Swapanza state...')
        
        # Clear all pending invites that are not active
        stale_chats = Chat.objects.filter(
            swapanza_requested_by__isnull=False,
            swapanza_active=False
        )
        
        count = 0
        for chat in stale_chats:
            self.stdout.write(f'Clearing stale invite in chat {chat.id} from {chat.swapanza_requested_by}')
            chat.swapanza_requested_by = None
            chat.swapanza_requested_at = None
            chat.swapanza_confirmed_users = []
            chat.swapanza_duration = None
            chat.save(update_fields=[
                'swapanza_requested_by', 
                'swapanza_requested_at', 
                'swapanza_confirmed_users',
                'swapanza_duration'
            ])
            count += 1
        
        # Clear expired active sessions
        expired_sessions = SwapanzaSession.objects.filter(
            active=True,
            ends_at__lt=timezone.now()
        )
        
        session_count = 0
        for session in expired_sessions:
            self.stdout.write(f'Deactivating expired session for {session.user}')
            session.active = False
            session.save(update_fields=['active'])
            session_count += 1
        
        # Clear expired active chats
        expired_chats = Chat.objects.filter(
            swapanza_active=True,
            swapanza_ends_at__lt=timezone.now()
        )
        
        chat_count = 0
        for chat in expired_chats:
            self.stdout.write(f'Deactivating expired Swapanza in chat {chat.id}')
            chat.swapanza_active = False
            chat.save(update_fields=['swapanza_active'])
            chat_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully cleaned up {count} stale invites, '
                f'{session_count} expired sessions, and {chat_count} expired chats'
            )
        )
