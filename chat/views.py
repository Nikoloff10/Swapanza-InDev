import logging
import os
from django.db.models import Q
from django.utils import timezone
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



@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_profile_image(request, user_id):
    """
    Upload a profile image to Cloudinary
    """
    
    if str(request.user.id) != str(user_id):
        return Response({"detail": "Not authorized"},
                        status=status.HTTP_403_FORBIDDEN)

    if 'profile_image' not in request.FILES:
        return Response({"detail": "No image provided"},
                        status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    image = request.FILES['profile_image']

    try:
        
        upload_result = cloudinary.uploader.upload(image,
                                                   folder="swapanza_profiles",
                                                   public_id=f"user_{user.id}",
                                                   overwrite=True,
                                                   resource_type="image")

        
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

    
    if request.method == 'PUT' and str(request.user.id) != str(user_id):
        return Response({"detail": "Not authorized"},
                        status=status.HTTP_403_FORBIDDEN)

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
        
        other_user = get_object_or_404(User, id=user_id)
        chat = Chat.objects.filter(participants=request.user).filter(
            participants=other_user).first()

        if chat:
            serializer = ChatSerializer(chat)
            return Response(serializer.data)
        else:
            return Response({"detail": "Chat not found"},
                            status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def chat_messages(request, chat_id):
    chat = get_object_or_404(Chat, id=chat_id)
    if request.user not in chat.participants.all():
        return Response({"error": "Not a participant of this chat."},
                        status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        messages = chat.messages.all()
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = MessageSerializer(data=request.data)
        if serializer.is_valid():

            message = serializer.save(chat=chat, sender=request.user)
            return Response(MessageSerializer(message).data,
                            status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)


class UserCreate(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.AllowAny, )


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter users by search query excluding current user"""
        queryset = User.objects.exclude(id=self.request.user.id)
        search = self.request.query_params.get('search', None)

        if search:
            
            queryset = queryset.filter(username__icontains=search)

        
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
    """Get counts of unread messages for all chats"""
    user = request.user
    chats = Chat.objects.filter(participants=user)

    unread_counts = {}
    for chat in chats:
        
        count = Message.objects.filter(chat=chat).exclude(
            read_by=user  
        ).exclude(sender=user).count()

        if count > 0:
            unread_counts[str(chat.id)] = count

    print(f"Unread counts for user {user.username}: {unread_counts}")
    return Response(unread_counts)


class ChatDetailView(generics.RetrieveUpdateAPIView):
    queryset = Chat.objects.all().prefetch_related('messages__sender',
                                                   'participants')
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = pagination.PageNumberPagination

    def get_queryset(self):

        return Chat.objects.prefetch_related('messages__sender',
                                             'participants').all()

    def get_object(self):
        obj = super().get_object()

        obj.messages.all()
        return obj

    def update(self, request, *args, **kwargs):
        chat = self.get_object()

        Message.objects.create(chat=chat,
                               sender=request.user,
                               content=request.data.get('content'))

        chat.refresh_from_db()
        serializer = self.get_serializer(chat)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data

        
        now = timezone.now()
        swapanza_active = False

        if instance.swapanza_active and instance.swapanza_ends_at and instance.swapanza_ends_at > now:
            swapanza_active = True

        data['swapanza_active'] = swapanza_active
        if swapanza_active:
            data['swapanza_ends_at'] = instance.swapanza_ends_at.isoformat(
            ) if instance.swapanza_ends_at else None
            data['swapanza_message_count'] = instance.swapanza_message_count or {}

        return Response(data)


logger = logging.getLogger(__name__)


class MessageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        chat_id = self.kwargs['chat_id']
        return Message.objects.filter(chat_id=chat_id,
                                      chat__participants=self.request.user)

    def create(self, request, *args, **kwargs):
        chat_id = self.kwargs['chat_id']
        chat = get_object_or_404(Chat, pk=chat_id, participants=request.user)

        data = request.data.copy()
        serializer = self.get_serializer(data=data)
        if not serializer.is_valid():
            logger.error('Serializer errors: %s', serializer.errors)
            return Response(serializer.errors,
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            message = serializer.save(chat=chat, sender=request.user)
        except Exception as e:
            logger.error('Error saving message: %s', str(e))
            traceback.print_exc()
            return Response({'detail': 'Error saving message.'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(self.get_serializer(message).data,
                        status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_notifications(request):
    """Reset all unread messages for the user"""
    user = request.user

    
    chats = Chat.objects.filter(participants=user)

    
    total_updated = 0
    for chat in chats:
        unread_messages = Message.objects.filter(chat=chat).exclude(
            read_by=user  
        ).exclude(sender=user)

        for message in unread_messages:
            message.read_by.add(user)
            total_updated += 1

    return Response({"message": f"Reset {total_updated} notifications"},
                    status=status.HTTP_200_OK)


def index(request):
    return render(request, 'index.html')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_active_swapanza(request):
    """Get active Swapanza session for the current user"""
    user = request.user
    now = timezone.now()

    
    chat_id = request.query_params.get('chat_id')

    
    active_session = SwapanzaSession.objects.filter(user=user,
                                                    active=True,
                                                    ends_at__gt=now).first()

    if not active_session:
        return Response({'active': False})

    
    partner = active_session.partner
    session_chat = active_session.chat

    
    chat_specific_count = 0
    if chat_id:
        try:
            current_chat = Chat.objects.get(id=chat_id)
            chat_message_counts = current_chat.swapanza_message_count or {}
            chat_specific_count = chat_message_counts.get(str(user.id), 0)
        except Chat.DoesNotExist:
            pass

    
    total_message_count = Message.objects.filter(
        sender=user,
        during_swapanza=True,
        created_at__gte=active_session.started_at).count()

    
    remaining_messages = max(0, 2 - total_message_count)

    return Response({
        'active':
        True,
        'partner_id':
        partner.id,
        'partner_username':
        partner.username,
        'partner_profile_image':
        partner.profile_image_url
        if hasattr(partner, 'profile_image_url') else None,
        'ends_at':
        active_session.ends_at,
        'started_at':
        active_session.started_at,
        'message_count':
        total_message_count,
        'chat_specific_count':
        chat_specific_count,
        'remaining_messages':
        remaining_messages,
        'chat_id':
        session_chat.id if session_chat else None
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def can_start_swapanza(request):
    """Check if the user can start a Swapanza"""
    user = request.user
    now = timezone.now()

    
    active_session = SwapanzaSession.objects.filter(user=user,
                                                    active=True,
                                                    ends_at__gt=now).first()

    if active_session:
        return Response({
            'can_start':
            False,
            'reason':
            'You are already in an active Swapanza session'
        })

    
    return Response({'can_start': True})



class ChatListView(generics.ListCreateAPIView):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        
        user = self.request.user
        queryset = Chat.objects.filter(participants=user).order_by('-id')

        
        include_closed = self.request.query_params.get(
            'include_closed', 'false').lower() == 'true'

        if not include_closed:
            
            pass

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data

        
        now = timezone.now()

        for chat_data in data:
            chat = Chat.objects.get(id=chat_data['id'])

            
            if chat.swapanza_requested_by:
                chat_data[
                    'swapanza_requested_by'] = chat.swapanza_requested_by.id
                chat_data['swapanza_duration'] = chat.swapanza_duration
                chat_data['swapanza_confirmed_users'] = chat.swapanza_confirmed_users or []
                if chat.swapanza_requested_at:
                    chat_data[
                        'swapanza_requested_at'] = chat.swapanza_requested_at.isoformat(
                        )

            
            chat_data['swapanza_active'] = (chat.swapanza_active
                                            and chat.swapanza_ends_at
                                            and chat.swapanza_ends_at > now)

            if chat_data['swapanza_active']:
                chat_data[
                    'swapanza_ends_at'] = chat.swapanza_ends_at.isoformat()
                chat_data['swapanza_message_count'] = chat.swapanza_message_count or {}

        return Response(data)
