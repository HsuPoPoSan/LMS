"""
DRF Serializers — replace FastAPI / Pydantic models
"""
from rest_framework import serializers


class LicenseCreateSerializer(serializers.Serializer):
    customer_name = serializers.CharField(min_length=1, max_length=200)
    customer_email = serializers.EmailField(required=False, default="", allow_blank=True)
    product_name = serializers.CharField(required=False, default="General", allow_blank=True)
    license_type = serializers.CharField(required=False, default="standard", allow_blank=True)
    expiry_date = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    max_activations = serializers.IntegerField(required=False, default=1, min_value=1)
    notes = serializers.CharField(required=False, default="", allow_blank=True)
    custom_key = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)


class LicenseUpdateSerializer(serializers.Serializer):
    customer_name = serializers.CharField(required=False, min_length=1, max_length=200)
    customer_email = serializers.EmailField(required=False, allow_blank=True)
    product_name = serializers.CharField(required=False, allow_blank=True)
    license_type = serializers.CharField(required=False, allow_blank=True)
    expiry_date = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    max_activations = serializers.IntegerField(required=False, min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True)


class ActivateSerializer(serializers.Serializer):
    device_id = serializers.CharField(min_length=1, max_length=300)


class ValidateSerializer(serializers.Serializer):
    license_key = serializers.CharField()
    device_id = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
