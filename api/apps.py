from django.apps import AppConfig


class ChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # package will be renamed to 'api' but keep label 'chat' to preserve migrations
    name = 'api'
    label = 'chat'
