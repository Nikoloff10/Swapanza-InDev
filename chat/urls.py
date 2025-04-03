from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView
from . import views

urlpatterns = [
    path('chats/<int:pk>/', views.ChatDetailView.as_view()),
    path('chats/', views.ChatListCreateView.as_view(), name='chat-list-create'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('users/create/', views.UserCreate.as_view(), name='user-create'),

    path('profile/', views.user_profile, name='user-profile'),
    path('profile/<int:user_id>/', views.user_profile, name='user-profile-detail'),
    
    path('profile/<int:user_id>/upload-image/', views.upload_profile_image, name='upload-profile-image'),

    path('users/', views.UserListView.as_view(), name='user-list'),
    path('unread-counts/', views.unread_message_counts, name='unread-counts'),
    path('reset-notifications/', views.reset_notifications, name='reset-notifications'),
    path('chats/find-by-user/<int:user_id>/', views.find_chat_by_user, name='find-chat-by-user'),

    path('active-swapanza/', views.get_active_swapanza, name='active-swapanza'),
    path('can-start-swapanza/', views.can_start_swapanza, name='can-start-swapanza'),

    

    path('', views.index, name='index'),
]