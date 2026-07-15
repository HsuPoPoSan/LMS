"""
DRF API Views — equivalent of all FastAPI route handlers in main.py
All routes are under /api/ (see licenses/urls.py)
"""
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from database import Database
from license_utils import generate_license_key, validate_key_format, days_until_expiry
from .serializers import (
    LicenseCreateSerializer,
    LicenseUpdateSerializer,
    ActivateSerializer,
    ValidateSerializer,
)

db = Database()


# ── Helper ─────────────────────────────────────────────────────────────────

def _enrich(lic: dict | None) -> dict | None:
    """Attach computed days_until_expiry to a license record."""
    if lic:
        lic["days_until_expiry"] = days_until_expiry(lic.get("expiry_date"))
    return lic


def _404(detail="License not found"):
    return Response({"detail": detail}, status=status.HTTP_404_NOT_FOUND)


def _400(detail):
    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)


# ── Stats ───────────────────────────────────────────────────────────────────

class StatsView(APIView):
    """GET /api/stats — dashboard statistics"""

    def get(self, request):
        return Response(db.get_dashboard_stats())


# ── Licenses List & Create ──────────────────────────────────────────────────

class LicenseListCreateView(APIView):
    """
    GET  /api/licenses          — list all licenses (optional ?status= & ?search=)
    POST /api/licenses          — create a new license
    """

    def get(self, request):
        status_filter = request.query_params.get("status")
        search = request.query_params.get("search")
        licenses = db.get_licenses(status_filter=status_filter, search=search)
        return Response([_enrich(l) for l in licenses])

    def post(self, request):
        serializer = LicenseCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        key = data.get("custom_key") or generate_license_key()

        if not validate_key_format(key):
            return _400("Invalid license key format")

        if db.get_license_by_key(key):
            return Response({"detail": "License key already exists"}, status=status.HTTP_409_CONFLICT)

        lic = db.create_license(
            license_key=key,
            customer_name=data["customer_name"],
            customer_email=data.get("customer_email", ""),
            product_name=data.get("product_name", "General"),
            license_type=data.get("license_type", "standard"),
            expiry_date=data.get("expiry_date"),
            max_activations=data.get("max_activations", 1),
            notes=data.get("notes", ""),
        )
        if not lic:
            return Response({"detail": "Failed to create license"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(_enrich(lic), status=status.HTTP_201_CREATED)


# ── Single License ──────────────────────────────────────────────────────────

class LicenseDetailView(APIView):
    """
    GET    /api/licenses/<id>   — retrieve
    PATCH  /api/licenses/<id>   — partial update
    DELETE /api/licenses/<id>   — delete
    """

    def get(self, request, license_id):
        lic = db.get_license_by_id(license_id)
        if not lic:
            return _404()
        return Response(_enrich(lic))

    def patch(self, request, license_id):
        serializer = LicenseUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updates = {k: v for k, v in serializer.validated_data.items() if v is not None}
        if not updates:
            return _400("No fields to update")

        lic = db.update_license(license_id, **updates)
        if not lic:
            return _404()
        return Response(_enrich(lic))

    def delete(self, request, license_id):
        if not db.get_license_by_id(license_id):
            return _404()
        db.delete_license(license_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Action Views ────────────────────────────────────────────────────────────

class LicenseActivateView(APIView):
    """POST /api/licenses/<id>/activate"""

    def post(self, request, license_id):
        serializer = ActivateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        lic = db.get_license_by_id(license_id)
        if not lic:
            return _404()
        if lic["status"] == "revoked":
            return Response({"detail": "License is revoked and cannot be activated"}, status=status.HTTP_403_FORBIDDEN)
        if lic["status"] == "expired":
            return Response({"detail": "License has expired"}, status=status.HTTP_403_FORBIDDEN)

        device_id = serializer.validated_data["device_id"]
        if lic.get("device_id") and lic["device_id"] != device_id:
            return Response({"detail": "License is already bound to a different device"}, status=status.HTTP_409_CONFLICT)

        result = db.activate_license(license_id, device_id)
        if not result:
            return Response({"detail": "Activation failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(_enrich(result))


class LicenseRevokeView(APIView):
    """POST /api/licenses/<id>/revoke"""

    def post(self, request, license_id):
        if not db.get_license_by_id(license_id):
            return _404()
        result = db.revoke_license(license_id)
        return Response(_enrich(result))


class LicenseExpireView(APIView):
    """POST /api/licenses/<id>/expire"""

    def post(self, request, license_id):
        if not db.get_license_by_id(license_id):
            return _404()
        result = db.expire_license(license_id)
        return Response(_enrich(result))


class LicenseReactivateView(APIView):
    """POST /api/licenses/<id>/reactivate — reset back to inactive"""

    def post(self, request, license_id):
        if not db.get_license_by_id(license_id):
            return _404()
        result = db.update_license(
            license_id,
            status="inactive",
            device_id=None,
            activated_at=None,
            expired_at=None,
        )
        return Response(_enrich(result))


# ── Validate ────────────────────────────────────────────────────────────────

class ValidateView(APIView):
    """POST /api/validate — validate a license key (optionally with device_id)"""

    def post(self, request):
        serializer = ValidateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        result = db.validate_license_key(data["license_key"], data.get("device_id"))
        if result.get("license"):
            result["license"] = _enrich(result["license"])
        return Response(result)


# ── Expiring Soon ────────────────────────────────────────────────────────────

class ExpiringView(APIView):
    """GET /api/licenses/expiring/<days>"""

    def get(self, request, days=30):
        return Response([_enrich(l) for l in db.get_expiring_soon(days)])


# ── Audit Logs ────────────────────────────────────────────────────────────────

class AuditLogView(APIView):
    """GET /api/audit-logs?limit=100"""

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", 100))
            limit = max(1, min(limit, 500))
        except ValueError:
            limit = 100
        return Response(db.get_audit_logs(limit=limit))
