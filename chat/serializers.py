from datetime import timezone
from rest_framework import serializers
from .models import Chat, User, Message

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, style={'input_type': 'password'}, required=False)
    email = serializers.EmailField(required=True)
    profile_image_url = serializers.URLField(read_only=True)


    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'confirm_password', 'profile_image_url')

    def validate(self, data):
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({"confirm_password": "Passwords do NOT match."})
        return data

    def create(self, validated_data):
        password = validated_data.pop('password', None) 
        validated_data.pop('confirm_password', None) 
        user = User.objects.create_user(**validated_data) 
        user.set_password(password) 
        user.save()
        return user

class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    
    class Meta:
        model = Message
        fields = ['id', 'chat', 'sender', 'sender_username', 'content', 'created_at']
        read_only_fields = ['sender', 'created_at']

class ChatSerializer(serializers.ModelSerializer):
    is_active_switch = serializers.SerializerMethodField()
    remaining_switch_time = serializers.SerializerMethodField()
    both_accepted = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ['id', 'participants', 'created_at', 'is_switched',
                 'switch_started_at', 'switch_ends_at', 'original_user_1',
                 'original_user_2', 'switch_requested_by', 
                 'switch_accepted_by_user1', 'switch_accepted_by_user2',
                 'is_active_switch', 'remaining_switch_time', 'both_accepted']

    def get_is_active_switch(self, obj):
        if obj.is_switched and obj.switch_ends_at:
            return obj.switch_ends_at > timezone.now()
        return False

    def get_remaining_switch_time(self, obj):
        if obj.is_switched and obj.switch_ends_at:
            remaining = obj.switch_ends_at - timezone.now()
            return max(0, remaining.total_seconds())
        return 0
        
    def get_both_accepted(self, obj):
        return obj.switch_accepted_by_user1 and obj.switch_accepted_by_user2