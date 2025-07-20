from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Chat, Message
from django.core.validators import RegexValidator

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'password', 'profile_image_url')
        extra_kwargs = {'password': {'write_only': True}}

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('A user with that username already exists.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with that email already exists.')
        return value

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('Password must be at least 8 characters long.')
        if not any(c.isalpha() for c in value):
            raise serializers.ValidationError('Password must contain at least one letter.')
        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError('Password must contain at least one number.')
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        instance = self.Meta.model(**validated_data)
        if password is not None:
            instance.set_password(password)
        instance.save()
        return instance

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'sender', 'content', 'created_at', 'during_swapanza', 'apparent_sender', 
                  'apparent_sender_username', 'apparent_sender_profile_image']
        read_only_fields = ['id', 'sender']

    def create(self, validated_data):
        
        chat = validated_data.pop('chat', None)
        sender = validated_data.pop('sender', None)
        return Message.objects.create(chat=chat, sender=sender, **validated_data)

class ChatSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    messages = MessageSerializer(many=True, read_only=True)
    participants_usernames = serializers.SerializerMethodField()
    swapanza_requested_by = serializers.SerializerMethodField()
    swapanza_requested_by_username = serializers.SerializerMethodField()
    swapanza_duration = serializers.IntegerField(read_only=True)
    swapanza_requested_at = serializers.DateTimeField(read_only=True)
    swapanza_confirmed_users = serializers.ListField(read_only=True)

    class Meta:
        model = Chat
        fields = [
            'id', 'participants', 'participants_usernames', 'messages', 'created_at',
            'swapanza_requested_by', 'swapanza_requested_by_username', 'swapanza_duration',
            'swapanza_requested_at', 'swapanza_confirmed_users'
        ]
        read_only_fields = ['id', 'created_at']

    def get_participants_usernames(self, obj):
        return [user.username for user in obj.participants.all()]

    def get_swapanza_requested_by(self, obj):
        return obj.swapanza_requested_by.id if obj.swapanza_requested_by else None

    def get_swapanza_requested_by_username(self, obj):
        return obj.swapanza_requested_by.username if obj.swapanza_requested_by else None

    def create(self, validated_data):
        participants = validated_data.pop('participants', [])
        chat = Chat.objects.create()
        for participant_id in participants:
            try:
                participant = User.objects.get(pk=participant_id)
                chat.participants.add(participant)
            except User.DoesNotExist:
                raise serializers.ValidationError(f"User with id {participant_id} not found.")
        return chat