from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView
from . import views

urlpatterns = [
    path('chats/<int:pk>/', views.ChatDetailView.as_view()),
    path('chats/', views.ChatListCreateView.as_view(), name='chat-list-create'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('users/create/', views.UserCreate.as_view(), name='user-create'),
    path('profile/', views.profile, name='profile'),
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('', views.index, name='index'),
]