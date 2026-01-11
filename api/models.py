
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.utils import timezone

class User(AbstractUser):
    email = models.EmailField(unique=True)
    profile_image_public_id = models.CharField(max_length=255, blank=True, null=True)
    profile_image_url = models.CharField(max_length=255, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.username

class Chat(models.Model):
    participants = models.ManyToManyField(User, related_name='chats')
    created_at = models.DateTimeField(auto_now_add=True)

    # Swapanza fields
    swapanza_requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='swapanza_requests')
    swapanza_duration = models.IntegerField(default=5, null=True, blank=True)
    swapanza_confirmed_users = models.JSONField(default=list, null=True, blank=True)
    swapanza_active = models.BooleanField(default=False)
    swapanza_started_at = models.DateTimeField(null=True, blank=True)
    swapanza_ends_at = models.DateTimeField(null=True, blank=True)
    swapanza_message_count = models.JSONField(default=dict, null=True, blank=True)
    swapanza_requested_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Chat {self.id} between {self.participants.count()} users"
    
    def reset_swapanza(self):
        """Reset all Swapanza-related fields"""
        self.swapanza_active = False
        self.swapanza_requested_by = None
        self.swapanza_started_at = None
        self.swapanza_ends_at = None
        self.swapanza_message_count = {}
        self.swapanza_confirmed_users = []
        self.save()

class Message(models.Model):
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    read_by = models.ManyToManyField(User, related_name='read_messages', blank=True)
    during_swapanza = models.BooleanField(default=False)
    apparent_sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='apparent_messages')
    apparent_sender_username = models.CharField(max_length=150, blank=True, null=True)
    apparent_sender_profile_image = models.CharField(max_length=500, blank=True, null=True)


    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['chat', 'created_at']),
            models.Index(fields=['sender', 'during_swapanza']),
        ]
    
    def __str__(self):
        return f"Message {self.id} from {self.sender.username} in chat {self.chat.id}"



class SwapanzaSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='swapanza_sessions')
    partner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='swapanza_partners')
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='swapanza_sessions', null=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ends_at = models.DateTimeField()
    active = models.BooleanField(default=True)
    message_count = models.IntegerField(default=0)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'active']),
            models.Index(fields=['ends_at']),
        ]
    
    def __str__(self):
        return f"Swapanza: {self.user.username} as {self.partner.username} until {self.ends_at}"