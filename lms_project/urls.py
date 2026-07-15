"""
Root URL configuration for LicenseManager Pro
"""
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Frontend SPA
    path("", TemplateView.as_view(template_name="index.html"), name="frontend"),
    path("login/", TemplateView.as_view(template_name="login.html"), name="login"),

    # API routes
    path("api/", include("licenses.urls")),
    path("api/", include("users.urls")),
]

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
