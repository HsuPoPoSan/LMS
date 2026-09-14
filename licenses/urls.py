"""
URL patterns for the licenses app — mounted at /api/ in lms_project/urls.py
"""
# pyrefly: ignore [missing-import]
from django.urls import path
from . import views

urlpatterns = [
    # Stats
    path("stats", views.StatsView.as_view(), name="stats"),

    # ── Customers ──────────────────────────────────────────────────────────
    path("customers", views.CustomerListCreateView.as_view(), name="customer-list-create"),
    path("customers/<str:customer_id>", views.CustomerDetailView.as_view(), name="customer-detail"),
    path("customers/<str:customer_id>/licenses", views.CustomerLicensesView.as_view(), name="customer-licenses"),

    # ── Licenses CRUD ──────────────────────────────────────────────────────
    path("licenses", views.LicenseListCreateView.as_view(), name="license-list-create"),
    path("licenses/<str:license_id>", views.LicenseDetailView.as_view(), name="license-detail"),

    # License actions
    path("licenses/<str:license_id>/activate",   views.LicenseActivateView.as_view(),   name="license-activate"),
    path("licenses/<str:license_id>/revoke",     views.LicenseRevokeView.as_view(),     name="license-revoke"),
    path("licenses/<str:license_id>/expire",     views.LicenseExpireView.as_view(),     name="license-expire"),
    path("licenses/<str:license_id>/reactivate", views.LicenseReactivateView.as_view(), name="license-reactivate"),

    # Expiring soon — must come BEFORE <license_id> to avoid conflict
    path("licenses/expiring/<int:days>", views.ExpiringView.as_view(), name="license-expiring"),

    # Validation
    path("validate", views.ValidateView.as_view(), name="validate"),

    # Audit logs
    path("audit-logs", views.AuditLogView.as_view(), name="audit-logs"),
]
