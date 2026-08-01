"""
DRF Serializers — License and AuditLog using ModelSerializer
"""
from rest_framework import serializers
from .models import License, AuditLog


# ── Read Serializers ────────────────────────────────────────────────────────

class LicenseSerializer(serializers.ModelSerializer):
    """Full license representation returned by list/detail endpoints."""
    days_until_expiry = serializers.SerializerMethodField()

    class Meta:
        model  = License
        fields = [
            "id", "license_key", "status", "device_id",
            "activated_at", "expired_at", "expiry_date",
            "customer_name", "customer_email", "product_name",
            "license_type", "max_activations", "notes",
            "created_at", "updated_at", "days_until_expiry",
        ]

    def get_days_until_expiry(self, obj):
        if not obj.expiry_date:
            return None
        from django.utils import timezone
        delta = obj.expiry_date - timezone.now()
        return delta.days


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AuditLog
        fields = ["id", "action", "license_id", "license_key",
                  "details", "performed_by", "created_at"]


# ── Write Serializers ───────────────────────────────────────────────────────

class LicenseCreateSerializer(serializers.Serializer):
    customer_name   = serializers.CharField(min_length=1, max_length=200)
    customer_email  = serializers.EmailField(required=False, default="", allow_blank=True)
    product_name    = serializers.CharField(required=False, default="General", allow_blank=True)
    license_type    = serializers.ChoiceField(
        required=False, default="standard",
        choices=["trial", "standard", "professional", "enterprise"],
    )
    expiry_date     = serializers.DateTimeField(required=False, allow_null=True, default=None)
    max_activations = serializers.IntegerField(required=False, default=1, min_value=1)
    notes           = serializers.CharField(required=False, default="", allow_blank=True)
    custom_key      = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)


class LicenseUpdateSerializer(serializers.Serializer):
    customer_name   = serializers.CharField(required=False, min_length=1, max_length=200)
    customer_email  = serializers.EmailField(required=False, allow_blank=True)
    product_name    = serializers.CharField(required=False, allow_blank=True)
    license_type    = serializers.ChoiceField(
        required=False,
        choices=["trial", "standard", "professional", "enterprise"],
    )
    expiry_date     = serializers.DateTimeField(required=False, allow_null=True)
    max_activations = serializers.IntegerField(required=False, min_value=1)
    notes           = serializers.CharField(required=False, allow_blank=True)
    status          = serializers.ChoiceField(
        required=False,
        choices=["inactive", "active", "expired", "revoked"],
    )


class ActivateSerializer(serializers.Serializer):
    device_id = serializers.CharField(min_length=1, max_length=300)


class ValidateSerializer(serializers.Serializer):
    license_key = serializers.CharField()
    device_id   = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
