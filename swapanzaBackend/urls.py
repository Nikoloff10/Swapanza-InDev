from django.contrib import admin
from django.urls import path, include

from chat import views
from chat.views import index



urlpatterns = [
    path('', include('chat.urls')),
    path('admin/', admin.site.urls),
    path('api/', include('chat.urls')),
    path('login/', views.index, name='login'),
]