from django.contrib.auth.models import User
from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "username", "email",
            "first_name", "last_name",
            "is_active", "is_staff",
            "date_joined", "last_login",
        ]
        read_only_fields = ["id", "date_joined", "last_login"]


class UserCreateSerializer(serializers.Serializer):
    username   = serializers.CharField(min_length=3, max_length=150)
    password   = serializers.CharField(min_length=6)
    email      = serializers.EmailField(required=False, allow_blank=True, default="")
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name  = serializers.CharField(required=False, allow_blank=True, default="")
    is_staff   = serializers.BooleanField(required=False, default=False)


class UserUpdateSerializer(serializers.Serializer):
    email      = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name  = serializers.CharField(required=False, allow_blank=True)
    is_active  = serializers.BooleanField(required=False)
    is_staff   = serializers.BooleanField(required=False)
    password   = serializers.CharField(required=False, allow_blank=True, min_length=6)
