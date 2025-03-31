import logging
import os
from time import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.views.decorators.csrf import csrf_exempt
import cloudinary.uploader
from swapanzaBackend import settings
from .models import Chat, Message, SwapanzaSession
from .serializers import ChatSerializer, MessageSerializer, UserSerializer
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404, render
from rest_framework import filters, pagination

User = get_user_model()

# Add this view for profile image upload
@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_profile_image(request, user_id):
    """
    Upload a profile image to Cloudinary
    """
    # Only allow users to update their own profile
    if str(request.user.id) != str(user_id):
        return Response({"detail": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
    
    if 'profile_image' not in request.FILES:
        return Response({"detail": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)
    
    user = request.user
    image = request.FILES['profile_image']
    
    try:
        # Upload to Cloudinary
        upload_result = cloudinary.uploader.upload(
            image,
            folder="swapanza_profiles",
            public_id=f"user_{user.id}",
            overwrite=True,
            resource_type="image"
        )
        
        # Save the Cloudinary URL to the user profile
        user.profile_image_url = upload_result['secure_url']
        user.save()
        
        return Response({
            "profile_image_url": user.profile_image_url,
            "username": user.username
        })
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def user_profile(request, user_id=None):
    """
    Retrieve or update user profile
    """
    if user_id:
        user = get_object_or_404(User, id=user_id)
    else:
        user = request.user
    
    # Only allow users to update their own profile
    if request.method == 'PUT' and str(request.user.id) != str(user_id):
        return Response({"detail": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'GET':
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email if user == request.user else None,
            "profile_image_url": user.profile_image_url,
            "bio": getattr(user, 'bio', ''),
        })
    
    elif request.method == 'PUT':
        if 'bio' in request.data:
            user.bio = request.data['bio']
            user.save()
        
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "profile_image_url": user.profile_image_url,
            "bio": user.bio
        })



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def find_chat_by_user(request, user_id):
    """
    Find an existing chat between the current user and the specified user
    """
    try:
        # Find chats where both users are participants
        other_user = get_object_or_404(User, id=user_id)
        chat = Chat.objects.filter(
            participants=request.user
        ).filter(
            participants=other_user
        ).first()
        
        if chat:
            serializer = ChatSerializer(chat)
            return Response(serializer.data)
        else:
            return Response({"detail": "Chat not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


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
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter users by search query excluding current user"""
        queryset = User.objects.exclude(id=self.request.user.id)
        search = self.request.query_params.get('search', None)
        
        if search:
            # Match even partial usernames - make search more generous
            queryset = queryset.filter(username__icontains=search)
            
        # Limit to 10 results for performance
        return queryset[:10]

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
    """
    Get counts of unread messages for all user's chats
    """
    user = request.user
    
    # Get all chats the user is part of
    chats = Chat.objects.filter(participants=user)
    
    # For each chat, count unread messages not sent by this user
    unread_counts = {}
    for chat in chats:
        count = Message.objects.filter(
            chat=chat, 
            seen=False
        ).exclude(sender=user).count()
        
        if count > 0:
            unread_counts[chat.id] = count
    
    print(f"Unread counts for user {user.username}: {unread_counts}")
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



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_notifications(request):
    """Reset all unread messages for the user"""
    user = request.user
    
    # Get all chats the user is part of
    chats = Chat.objects.filter(participants=user)
    
    # For each chat, mark messages as read
    total_updated = 0
    for chat in chats:
        updated = Message.objects.filter(
            chat=chat,
            seen=False
        ).exclude(sender=user).update(seen=True)
        total_updated += updated
    
    return Response({"message": f"Reset {total_updated} notifications"}, status=status.HTTP_200_OK)

def index(request):
    return render(request, 'index.html')



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_active_swapanza(request):
    """Get active Swapanza session for the current user"""
    user = request.user
    
    # Check for active session
    session = SwapanzaSession.objects.filter(
        user=user,
        active=True,
        ends_at__gt=timezone.now()
    ).first()
    
    if not session:
        return Response({
            'active': False
        })
    
    return Response({
        'active': True,
        'partner_id': session.partner.id,
        'partner_username': session.partner.username,
        'partner_profile_image': session.partner.profile_image_url if session.partner.profile_image_url else None,
        'ends_at': session.ends_at,
        'duration': round((session.ends_at - session.started_at).total_seconds() / 60),
        'message_count': session.message_count
    })