from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Chat, Message

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'profile_image_url')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        instance = self.Meta.model(**validated_data)
        if password is not None:
            instance.set_password(password)
        instance.save()
        return instance

class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'chat', 'sender', 'sender_username', 'content', 'created_at']
        read_only_fields = ['sender', 'created_at']

class ChatSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        many=True,
        write_only=True,
        required=True
    )

    class Meta:
        model = Chat
        fields = ['id', 'participants', 'created_at']
        read_only_fields = ['id', 'created_at']

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