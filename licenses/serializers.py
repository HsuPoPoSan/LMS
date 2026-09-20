"""
DRF Serializers — Customer, License, and AuditLog using ModelSerializer
"""
from rest_framework import serializers
from .models import Customer, License, AuditLog


# ── Customer Serializers ─────────────────────────────────────────────────────

class CustomerSerializer(serializers.ModelSerializer):
    """Full customer representation — includes license count."""
    license_count = serializers.SerializerMethodField()

    class Meta:
        model  = Customer
        fields = [
            "id", "company_name", "contact_name", "email",
            "phone", "notes", "created_at", "updated_at", "license_count",
        ]

    def get_license_count(self, obj):
        return obj.licenses.count()


class CustomerCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Customer
        fields = ["company_name", "contact_name", "email", "phone", "notes"]


class CustomerUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Customer
        fields = ["company_name", "contact_name", "email", "phone", "notes"]
        extra_kwargs = {field: {"required": False} for field in fields}


# ── Read Serializers ────────────────────────────────────────────────────────

class LicenseSerializer(serializers.ModelSerializer):
    """Full license representation returned by list/detail endpoints."""
    days_until_expiry = serializers.SerializerMethodField()
    customer          = CustomerSerializer(read_only=True)

    class Meta:
        model  = License
        fields = [
            "id", "license_key", "status", "customer",
            "device_id", "activated_at", "expired_at", "expiry_date",
            "product_name", "license_type", "max_activations", "notes",
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
    # customer_id is required — create the customer first via POST /api/customers
    customer_id     = serializers.UUIDField()
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
    customer_id     = serializers.UUIDField(required=False, allow_null=True)
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
