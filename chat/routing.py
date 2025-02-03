from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import re_path

websocket_urlpatterns = [
    
    
]

application = ProtocolTypeRouter({
    "websocket": URLRouter(
        websocket_urlpatterns
    ),
})