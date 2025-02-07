import os
from django.forms import ValidationError
from django.http import HttpResponse
from rest_framework import generics, permissions
from swapanzaBackend.settings import BASE_DIR
from swapanzaBackend import settings
from .models import Chat, User, Message
from .serializers import ChatSerializer, UserSerializer, MessageSerializer
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

class UserCreate(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

class UserList(generics.ListAPIView):
    
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly] 

    def get_queryset(self):
        queryset = User.objects.all()
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(username__icontains=search)
        return queryset

class MessageList(generics.ListAPIView):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        chat_id = self.request.query_params.get('chat_id', None)
        if chat_id is not None:
            return Message.objects.filter(chat_id=chat_id)
        return Message.objects.none()

class MessageCreate(generics.CreateAPIView):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        chat = Chat.objects.get(pk=self.request.data.get('chat'))
        if chat.is_switched:
            content = self.request.data.get('content', '')
            words = content.split()
            if len(words) > 1 or len(content) > 15:
                raise ValidationError("During switch, messages must be single words with max 15 characters")
        serializer.save(sender=self.request.user)



class ChatList(generics.ListAPIView):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]

class ChatCreate(generics.CreateAPIView):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        chat = serializer.save()
        chat.participants.add(self.request.user)
        
        if 'participants' in self.request.data:
            try:
                for user_id in self.request.data['participants']:
                    other_user = User.objects.get(id=user_id)
                    chat.participants.add(other_user)
            except User.DoesNotExist:
                raise ValidationError("User not found")
        return chat

    def create(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        try:
            response = super().create(request, *args, **kwargs)
            chat = Chat.objects.get(pk=response.data['id'])
            serializer = self.get_serializer(chat)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class ChatSwitchView(generics.UpdateAPIView):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def patch(self, request, *args, **kwargs):
        chat = self.get_object()
        action = request.data.get('action')
        user = request.user

        if action == 'request':
            if chat.is_switched:
                return Response(
                    {"error": "Chat is already in switched state"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            
            chat.switch_requested_by = user
            chat.switch_accepted_by_user1 = False
            chat.switch_accepted_by_user2 = False
            chat.save()
            
            return Response({
                "message": "Switch requested",
                "requested_by": user.username
            })

        elif action == 'accept':
            if not chat.switch_requested_by:
                return Response(
                    {"error": "No switch request pending"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if user == chat.switch_requested_by:
                chat.switch_accepted_by_user1 = True
            else:
                chat.switch_accepted_by_user2 = True
            
            chat.save()

            
            if chat.switch_accepted_by_user1 and chat.switch_accepted_by_user2:
                chat.is_switched = True
                chat.switch_started_at = timezone.now()
                chat.switch_ends_at = chat.switch_started_at + timedelta(minutes=5)
                chat.original_user_1 = chat.switch_requested_by
                chat.original_user_2 = user
                chat.save()
                
                return Response({
                    "message": "Switch activated",
                    "switch_ends_at": chat.switch_ends_at,
                    "original_user_1": chat.original_user_1.username,
                    "original_user_2": chat.original_user_2.username
                })
            
            return Response({
                "message": "Switch accepted, waiting for other user",
                "accepted_by_user1": chat.switch_accepted_by_user1,
                "accepted_by_user2": chat.switch_accepted_by_user2
            })

        return Response(
            {"error": "Invalid action"},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    user = request.user
    serializer = UserSerializer(user)
    return Response(serializer.data)

def index(request):
    try:
        with open(os.path.join(BASE_DIR, 'frontend', 'build', 'index.html'), 'r') as f:
            return HttpResponse(f.read())
    except FileNotFoundError:
        return HttpResponse("Please build the React app first by running 'npm run build' in the frontend directory")