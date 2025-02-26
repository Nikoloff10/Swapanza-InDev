import logging
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from .models import Chat, Message
from .serializers import ChatSerializer, MessageSerializer, UserSerializer
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404, render
from rest_framework import filters, pagination

User = get_user_model()

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def chat_messages(request, chat_id):
    chat = get_object_or_404(Chat, id=chat_id)
    if request.user not in chat.participants.all():
        return Response({"error": "Not a participant of this chat."}, status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'GET':
        messages = chat.messages.all()  
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = MessageSerializer(data=request.data)
        if serializer.is_valid():
            
            message = serializer.save(chat=chat, sender=request.user)
            return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_message_counts(request):
    """Return counts of unread messages for each chat the user is part of."""
    user = request.user
    chats = Chat.objects.filter(participants=user)
    
    
    unread_counts = {}
    for chat in chats:
        
        count = Message.objects.filter(
            chat=chat,
            seen=False
        ).exclude(
            sender=user
        ).count()
        
        if count > 0:
            unread_counts[chat.id] = count
            
    return Response(unread_counts)

class ChatDetailView(generics.RetrieveUpdateAPIView):
    queryset = Chat.objects.all().prefetch_related(
        'messages__sender',  
        'participants'
    )
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = pagination.PageNumberPagination

    def get_queryset(self):
        
        return Chat.objects.prefetch_related(
            'messages__sender', 
            'participants'
        ).all()

    def get_object(self):
        obj = super().get_object()
        
        obj.messages.all()
        return obj

    def update(self, request, *args, **kwargs):
        chat = self.get_object()
        
        
        Message.objects.create(
            chat=chat,
            sender=request.user,
            content=request.data.get('content')
        )
        
        
        chat.refresh_from_db()  
        serializer = self.get_serializer(chat)
        return Response(serializer.data)

logger = logging.getLogger(__name__)

class MessageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        chat_id = self.kwargs['chat_id']
        return Message.objects.filter(chat_id=chat_id, chat__participants=self.request.user)

    def create(self, request, *args, **kwargs):
        chat_id = self.kwargs['chat_id']
        chat = get_object_or_404(Chat, pk=chat_id, participants=request.user)
        
        data = request.data.copy()
        serializer = self.get_serializer(data=data)
        if not serializer.is_valid():
            logger.error('Serializer errors: %s', serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            message = serializer.save(chat=chat, sender=request.user)
        except Exception as e:
            logger.error('Error saving message: %s', str(e))
            traceback.print_exc()
            return Response({'detail': 'Error saving message.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(self.get_serializer(message).data, status=status.HTTP_201_CREATED)

def index(request):
    return render(request, 'index.html')