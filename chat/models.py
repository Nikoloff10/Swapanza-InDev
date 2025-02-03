from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    
    email = models.EmailField(unique=True)

class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('timestamp',)  

class Chat(models.Model):
    participants = models.ManyToManyField(User, related_name='chats')
    

    def __str__(self):
        return ", ".join([user.username for user in self.participants.all()])