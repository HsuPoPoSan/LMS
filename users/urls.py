from django.urls import path
from . import views

urlpatterns = [
    path("auth/login",  views.LoginView.as_view()),
    path("auth/logout", views.LogoutView.as_view()),
    path("auth/me",     views.CurrentUserView.as_view()),
    path("users",       views.UserListCreateView.as_view()),
    path("users/<int:user_id>", views.UserDetailView.as_view()),
]
