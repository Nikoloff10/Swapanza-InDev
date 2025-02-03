from rest_framework import serializers
from .models import Chat, User, Message

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, style={'input_type': 'password'}, required=False)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'confirm_password')

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
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    class Meta:
        model = Message
        fields = ('id', 'sender', 'receiver', 'content', 'timestamp')

class ChatSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    class Meta:
        model = Chat
        fields = ('id', 'participants')