from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.authtoken.models import Token

from .serializers import (
    LoginSerializer, UserSerializer,
    UserCreateSerializer, UserUpdateSerializer,
)


class LoginView(APIView):
    """POST /api/auth/login — returns token + user info"""
    permission_classes = [AllowAny]

    def post(self, request):
        s = LoginSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(
            username=s.validated_data["username"],
            password=s.validated_data["password"],
        )
        if not user:
            return Response({"detail": "Invalid username or password"},
                            status=status.HTTP_401_UNAUTHORIZED)
        if not user.is_active:
            return Response({"detail": "Account is disabled"},
                            status=status.HTTP_403_FORBIDDEN)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})


class LogoutView(APIView):
    """POST /api/auth/logout — deletes the token"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            request.user.auth_token.delete()
        except Exception:
            pass
        return Response({"detail": "Logged out"})


class CurrentUserView(APIView):
    """GET /api/auth/me — returns current user info"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserListCreateView(APIView):
    """
    GET  /api/users — list all users (admin only)
    POST /api/users — create a user (admin only)
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = User.objects.all().order_by("-date_joined")
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        s = UserCreateSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

        d = s.validated_data
        if User.objects.filter(username=d["username"]).exists():
            return Response({"detail": "Username already exists"},
                            status=status.HTTP_409_CONFLICT)

        user = User.objects.create_user(
            username=d["username"],
            password=d["password"],
            email=d.get("email", ""),
            first_name=d.get("first_name", ""),
            last_name=d.get("last_name", ""),
            is_staff=d.get("is_staff", False),
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    """
    GET    /api/users/<id> — retrieve (admin only)
    PATCH  /api/users/<id> — update (admin only)
    DELETE /api/users/<id> — delete (admin only)
    """
    permission_classes = [IsAdminUser]

    def _get(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

    def get(self, request, user_id):
        u = self._get(user_id)
        if not u:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserSerializer(u).data)

    def patch(self, request, user_id):
        u = self._get(user_id)
        if not u:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        s = UserUpdateSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

        d = s.validated_data
        for field in ("email", "first_name", "last_name", "is_active", "is_staff"):
            if field in d:
                setattr(u, field, d[field])
        if d.get("password"):
            u.set_password(d["password"])
        u.save()
        return Response(UserSerializer(u).data)

    def delete(self, request, user_id):
        u = self._get(user_id)
        if not u:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        if u.pk == request.user.pk:
            return Response({"detail": "Cannot delete your own account"},
                            status=status.HTTP_400_BAD_REQUEST)
        u.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
