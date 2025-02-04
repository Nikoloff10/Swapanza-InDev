import os
from django.http import FileResponse
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView

from swapanzaBackend import settings
from . import views

def manifest(request):
    manifest_path = os.path.join(settings.BASE_DIR, 'frontend', 'build', 'manifest.json')
    return FileResponse(open(manifest_path, 'rb'), content_type='application/json')

urlpatterns = [
    path('users/', views.UserList.as_view()),
    path('messages/', views.MessageList.as_view()),
    path('messages/create/', views.MessageCreate.as_view()),
    path('chats/', views.ChatList.as_view(), name='chat-list'),
    path('chats/create/', views.ChatCreate.as_view(), name='chat-create'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('users/create/', views.UserCreate.as_view(), name='user-create'),
    path('', views.index, name='index'),
]