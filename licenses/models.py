"""
Django ORM models for LicenseManager Pro.
These replace the raw Supabase SDK calls in database.py.
Tables are created in Supabase PostgreSQL via Django migrations.
"""
import uuid
from django.db import models


class License(models.Model):
    """Mirrors the licenseslist table — now managed by Django ORM."""

    STATUS_CHOICES = [
        ("inactive",  "Inactive"),
        ("active",    "Active"),
        ("expired",   "Expired"),
        ("revoked",   "Revoked"),
        ("suspended", "Suspended"),
    ]

    TYPE_CHOICES = [
        ("trial",        "Trial"),
        ("standard",     "Standard"),
        ("professional", "Professional"),
        ("enterprise",   "Enterprise"),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    license_key     = models.TextField(unique=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default="inactive")
    device_id       = models.TextField(blank=True, null=True)
    activated_at    = models.DateTimeField(blank=True, null=True)
    expired_at      = models.DateTimeField(blank=True, null=True)
    expiry_date     = models.DateTimeField(blank=True, null=True)
    customer_name   = models.CharField(max_length=200)
    customer_email  = models.EmailField(blank=True, default="")
    product_name    = models.CharField(max_length=200, default="General")
    license_type    = models.CharField(max_length=20, choices=TYPE_CHOICES, default="standard")
    max_activations = models.PositiveIntegerField(default=1)
    notes           = models.TextField(blank=True, default="")
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table  = "licenseslist"   # keep the existing Supabase table name
        ordering  = ["-created_at"]

    def __str__(self):
        return f"{self.license_key} ({self.status})"


class AuditLog(models.Model):
    """Records every action performed on a license."""

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action      = models.CharField(max_length=50)           # CREATE, ACTIVATE, REVOKE …
    license     = models.ForeignKey(
        License,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="audit_logs",
    )
    license_key  = models.TextField(blank=True, default="")
    details      = models.JSONField(default=dict, blank=True)
    performed_by = models.CharField(max_length=150, default="system")
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} — {self.license_key} @ {self.created_at}"
