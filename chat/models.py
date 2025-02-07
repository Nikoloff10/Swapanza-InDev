from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError

class User(AbstractUser):
    email = models.EmailField(unique=True)
    profile_image_public_id = models.CharField(max_length=255, blank=True, null=True)  
    profile_image_url = models.URLField(blank=True, null=True)  

    def __str__(self):
        return self.username

class Chat(models.Model):
    participants = models.ManyToManyField(User, related_name='chats')
    created_at = models.DateTimeField(auto_now_add=True)
    
    is_switched = models.BooleanField(default=False)
    switch_started_at = models.DateTimeField(null=True, blank=True)
    switch_ends_at = models.DateTimeField(null=True, blank=True)
    original_user_1 = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='original_chats_1')
    original_user_2 = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='original_chats_2')
    switch_requested_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='switch_requests')
    switch_accepted_by_user1 = models.BooleanField(default=False)
    switch_accepted_by_user2 = models.BooleanField(default=False)
    
    def __str__(self):
        return f"Chat {self.id} between {self.participants.count()} users"

class Message(models.Model):
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages', null=True)
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.chat.is_switched:
            words = self.content.split()
            if len(words) > 1:
                raise ValidationError("During switch, messages must be single words")
            if len(self.content) > 15:
                raise ValidationError("During switch, messages must be 15 characters or less")
    
    def __str__(self):
        return f"Message from {self.sender.username} in Chat {self.chat.id}"

    class Meta:
        ordering = ['created_at']