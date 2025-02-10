from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from .models import Chat, Message
from .serializers import ChatSerializer, MessageSerializer, UserSerializer
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import render
from rest_framework import filters

User = get_user_model()

class UserCreate(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.AllowAny,)

class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['username']

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

class ChatListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(participants=self.request.user)

    def perform_create(self, serializer):
        participants = self.request.data.get('participants', [])
        participants.append(self.request.user.id)
        serializer.save(participants=participants)


class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        chat_id = self.kwargs['chat_id']
        return Message.objects.filter(chat_id=chat_id)

    def perform_create(self, serializer):
        chat_id = self.request.data.get('chat')
        try:
            chat = Chat.objects.get(pk=chat_id, participants=self.request.user)
        except Chat.DoesNotExist:
            raise ValidationError("Chat not found or you are not a participant.")
        serializer.save(sender=self.request.user, chat=chat)

def index(request):
    return render(request, 'index.html')