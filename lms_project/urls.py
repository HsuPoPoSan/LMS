"""
Root URL configuration for LicenseManager Pro
"""
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Serve the frontend SPA at the root
    path("", TemplateView.as_view(template_name="index.html"), name="frontend"),

    # All API routes live under /api/
    path("api/", include("licenses.urls")),
]

# Serve static files from /static/ in development
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
