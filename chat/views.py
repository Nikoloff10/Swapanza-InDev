import os
from django.http import HttpResponse
from rest_framework import generics, permissions
from swapanzaBackend.settings import BASE_DIR
from swapanzaBackend import settings
from .models import Chat, User, Message
from .serializers import ChatSerializer, UserSerializer, MessageSerializer
from django.views.generic import TemplateView

class UserCreate(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

class UserList(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly] 

class MessageList(generics.ListAPIView):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class MessageCreate(generics.CreateAPIView):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

class ChatList(generics.ListAPIView):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]

class ChatCreate(generics.CreateAPIView):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]

def index(request):
    try:
        with open(os.path.join(BASE_DIR, 'frontend', 'build', 'index.html'), 'r') as f:
            return HttpResponse(f.read())
    except FileNotFoundError:
        return HttpResponse("Please build the React app first by running 'npm run build' in the frontend directory")