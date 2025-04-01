
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
    swapanza_active = models.BooleanField(default=False)
    swapanza_requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='requested_swaps')
    swapanza_duration = models.IntegerField(default=5)  # Duration in minutes
    swapanza_started_at = models.DateTimeField(null=True, blank=True)
    swapanza_ends_at = models.DateTimeField(null=True, blank=True)
    swapanza_message_count = models.JSONField(default=dict)  # Format: {user_id: message_count}
    swapanza_confirmed_users = models.JSONField(default=list)

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
    chat = models.ForeignKey(Chat, related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    apparent_sender = models.IntegerField(null=True, blank=True) 
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    timestamp = models.DateTimeField(default=timezone.now)
    seen = models.BooleanField(default=False)
    during_swapanza = models.BooleanField(default=False)

    def clean(self):
         # Check message constraints during Swapanza
        if self.chat.swapanza_active:
            content = self.content.strip()
            
            # Check for spaces
            if ' ' in content:
                raise ValidationError("During Swapanza, spaces are not allowed in messages")
                
            # Check character length
            if len(content) > 7:
                raise ValidationError("During Swapanza, messages are limited to 7 characters")
                
            # Mark message as sent during Swapanza
            self.during_swapanza = True

    def __str__(self):
        return f"Message from {self.sender.username} in Chat {self.chat.id}"

    class Meta:
        ordering = ['created_at']



class SwapanzaSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='swapanza_sessions')
    partner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='swapanza_partners')
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='swapanza_sessions', null=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ends_at = models.DateTimeField()
    active = models.BooleanField(default=True)
    message_count = models.IntegerField(default=0)
    
    def __str__(self):
        return f"Swapanza: {self.user.username} as {self.partner.username} until {self.ends_at}"