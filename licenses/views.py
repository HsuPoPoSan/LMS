"""
DRF API Views — using Django ORM (no supabase-py SDK).
All database operations go through the License, Customer, and AuditLog models.
"""
from datetime import datetime, timezone

from django.db import models as dj_models
from django.utils import timezone as dj_tz
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import License, Customer, AuditLog
from .serializers import (
    LicenseSerializer,
    AuditLogSerializer,
    LicenseCreateSerializer,
    LicenseUpdateSerializer,
    ActivateSerializer,
    ValidateSerializer,
    CustomerSerializer,
    CustomerCreateSerializer,
    CustomerUpdateSerializer,
)
from license_utils import generate_license_key, validate_key_format


# ── Helpers ─────────────────────────────────────────────────────────────────

def _404(detail="License not found"):
    return Response({"detail": detail}, status=status.HTTP_404_NOT_FOUND)


def _400(detail):
    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)


def _audit(action: str, license: License, details: dict = None, performed_by: str = "admin"):
    """Write an audit log entry (never raises)."""
    try:
        AuditLog.objects.create(
            action=action,
            license=license,
            license_key=license.license_key if license else "",
            details=details or {},
            performed_by=performed_by,
        )
    except Exception:
        pass


def _resolve_customer(data):
    """
    Returns (customer_instance, error_response).
    Looks up Customer by customer_id — must already exist.
    """
    customer_id = data.get("customer_id")
    try:
        return Customer.objects.get(pk=customer_id), None
    except Customer.DoesNotExist:
        return None, Response(
            {"detail": "Customer not found."},
            status=status.HTTP_404_NOT_FOUND,
        )


# ── Stats ────────────────────────────────────────────────────────────────────

class StatsView(APIView):
    """GET /api/stats — dashboard statistics"""

    def get(self, request):
        qs = License.objects.all()
        expiring_soon = (
            qs.filter(
                status="active",
                expiry_date__isnull=False,
                expiry_date__gt=dj_tz.now(),
                expiry_date__lte=dj_tz.now() + dj_tz.timedelta(days=30),
            ).count()
        )
        by_type = dict(
            qs.values("license_type")
              .annotate(n=dj_models.Count("id"))
              .values_list("license_type", "n")
        )
        return Response({
            "total_licenses":    qs.count(),
            "active_licenses":   qs.filter(status="active").count(),
            "inactive_licenses": qs.filter(status="inactive").count(),
            "expired_licenses":  qs.filter(status="expired").count(),
            "revoked_licenses":  qs.filter(status="revoked").count(),
            "expiring_soon":     expiring_soon,
            "by_type":           by_type,
            "total_customers":   Customer.objects.count(),
        })


# ── Customer CRUD ─────────────────────────────────────────────────────────────

class CustomerListCreateView(APIView):
    """
    GET  /api/customers   — list all customers
    POST /api/customers   — create a new customer
    """

    def get(self, request):
        search = request.query_params.get("search")
        qs = Customer.objects.all()
        if search:
            qs = qs.filter(
                dj_models.Q(company_name__icontains=search)
                | dj_models.Q(email__icontains=search)
                | dj_models.Q(contact_name__icontains=search)
            )
        return Response(CustomerSerializer(qs, many=True).data)

    def post(self, request):
        s = CustomerCreateSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        customer = s.save()
        return Response(CustomerSerializer(customer).data, status=status.HTTP_201_CREATED)


class CustomerDetailView(APIView):
    """
    GET    /api/customers/<id>
    PATCH  /api/customers/<id>
    DELETE /api/customers/<id>
    """

    def _get(self, customer_id):
        try:
            return Customer.objects.get(pk=customer_id)
        except (Customer.DoesNotExist, ValueError):
            return None

    def get(self, request, customer_id):
        customer = self._get(customer_id)
        if not customer:
            return _404("Customer not found")
        return Response(CustomerSerializer(customer).data)

    def patch(self, request, customer_id):
        customer = self._get(customer_id)
        if not customer:
            return _404("Customer not found")
        s = CustomerUpdateSerializer(customer, data=request.data, partial=True)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        s.save()
        return Response(CustomerSerializer(customer).data)

    def delete(self, request, customer_id):
        customer = self._get(customer_id)
        if not customer:
            return _404("Customer not found")
        customer.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomerLicensesView(APIView):
    """GET /api/customers/<id>/licenses — all licenses for one customer"""

    def get(self, request, customer_id):
        try:
            customer = Customer.objects.get(pk=customer_id)
        except (Customer.DoesNotExist, ValueError):
            return _404("Customer not found")
        qs = customer.licenses.all()
        status_filter = request.query_params.get("status")
        if status_filter and status_filter != "all":
            qs = qs.filter(status=status_filter)
        return Response(LicenseSerializer(qs, many=True).data)


# ── License List & Create ────────────────────────────────────────────────────

class LicenseListCreateView(APIView):
    """
    GET  /api/licenses   — list all licenses (?status= & ?search= & ?customer_id=)
    POST /api/licenses   — create a new license
    """

    def get(self, request):
        qs = License.objects.select_related("customer").all()
        status_filter = request.query_params.get("status")
        search        = request.query_params.get("search")
        customer_id   = request.query_params.get("customer_id")

        if status_filter and status_filter != "all":
            qs = qs.filter(status=status_filter)
        if customer_id:
            qs = qs.filter(customer__id=customer_id)
        if search:
            qs = qs.filter(
                dj_models.Q(license_key__icontains=search)
                | dj_models.Q(customer__company_name__icontains=search)
                | dj_models.Q(customer__email__icontains=search)
                | dj_models.Q(device_id__icontains=search)
            )
        return Response(LicenseSerializer(qs, many=True).data)

    def post(self, request):
        s = LicenseCreateSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

        d = s.validated_data
        key = d.get("custom_key") or generate_license_key()

        if not validate_key_format(key):
            return _400("Invalid license key format")

        if License.objects.filter(license_key=key).exists():
            return Response({"detail": "License key already exists"},
                            status=status.HTTP_409_CONFLICT)

        customer, err = _resolve_customer(d)
        if err:
            return err

        lic = License.objects.create(
            license_key=key,
            customer=customer,
            product_name=d.get("product_name", "General"),
            license_type=d.get("license_type", "standard"),
            expiry_date=d.get("expiry_date"),
            max_activations=d.get("max_activations", 1),
            notes=d.get("notes", ""),
            status="inactive",
        )
        _audit("CREATE", lic, {"customer": customer.company_name})
        return Response(LicenseSerializer(lic).data, status=status.HTTP_201_CREATED)


# ── Single License ───────────────────────────────────────────────────────────

class LicenseDetailView(APIView):
    """
    GET    /api/licenses/<id>
    PATCH  /api/licenses/<id>
    DELETE /api/licenses/<id>
    """

    def _get(self, license_id):
        try:
            return License.objects.select_related("customer").get(pk=license_id)
        except (License.DoesNotExist, ValueError):
            return None

    def get(self, request, license_id):
        lic = self._get(license_id)
        if not lic:
            return _404()
        return Response(LicenseSerializer(lic).data)

    def patch(self, request, license_id):
        lic = self._get(license_id)
        if not lic:
            return _404()

        s = LicenseUpdateSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

        updates = s.validated_data
        if not updates:
            return _400("No fields to update")

        # Handle customer reassignment
        customer_id = updates.pop("customer_id", None)
        if customer_id is not None:
            try:
                lic.customer = Customer.objects.get(pk=customer_id)
            except Customer.DoesNotExist:
                return _404("Customer not found")

        for field, value in updates.items():
            setattr(lic, field, value)
        lic.save()

        _audit("UPDATE", lic, {**updates, **({"customer_id": str(customer_id)} if customer_id else {})})
        return Response(LicenseSerializer(lic).data)

    def delete(self, request, license_id):
        lic = self._get(license_id)
        if not lic:
            return _404()
        _audit("DELETE", lic, {})
        lic.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Action Views ─────────────────────────────────────────────────────────────

class LicenseActivateView(APIView):
    """POST /api/licenses/<id>/activate"""

    def post(self, request, license_id):
        s = ActivateSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            lic = License.objects.get(pk=license_id)
        except (License.DoesNotExist, ValueError):
            return _404()

        if lic.status == "revoked":
            return Response({"detail": "License is revoked and cannot be activated"},
                            status=status.HTTP_403_FORBIDDEN)
        if lic.status == "expired":
            return Response({"detail": "License has expired"},
                            status=status.HTTP_403_FORBIDDEN)

        device_id = s.validated_data["device_id"]
        if lic.device_id and lic.device_id != device_id:
            return Response({"detail": "License is already bound to a different device"},
                            status=status.HTTP_409_CONFLICT)

        lic.status = "active"
        lic.device_id = device_id
        lic.activated_at = dj_tz.now()
        lic.save()

        _audit("ACTIVATE", lic, {"device_id": device_id})
        return Response(LicenseSerializer(lic).data)


class LicenseRevokeView(APIView):
    """POST /api/licenses/<id>/revoke"""

    def post(self, request, license_id):
        try:
            lic = License.objects.get(pk=license_id)
        except (License.DoesNotExist, ValueError):
            return _404()

        lic.status = "revoked"
        lic.expired_at = dj_tz.now()
        lic.save()

        _audit("REVOKE", lic, {})
        return Response(LicenseSerializer(lic).data)


class LicenseExpireView(APIView):
    """POST /api/licenses/<id>/expire"""

    def post(self, request, license_id):
        try:
            lic = License.objects.get(pk=license_id)
        except (License.DoesNotExist, ValueError):
            return _404()

        lic.status = "expired"
        lic.expired_at = dj_tz.now()
        lic.save()

        _audit("EXPIRE", lic, {})
        return Response(LicenseSerializer(lic).data)


class LicenseReactivateView(APIView):
    """POST /api/licenses/<id>/reactivate — reset back to inactive"""

    def post(self, request, license_id):
        try:
            lic = License.objects.get(pk=license_id)
        except (License.DoesNotExist, ValueError):
            return _404()

        lic.status = "inactive"
        lic.device_id = None
        lic.activated_at = None
        lic.expired_at = None
        lic.save()

        _audit("REACTIVATE", lic, {})
        return Response(LicenseSerializer(lic).data)


# ── Validate ─────────────────────────────────────────────────────────────────

class ValidateView(APIView):
    """POST /api/validate — validate a license key"""

    def post(self, request):
        s = ValidateSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

        d = s.validated_data
        try:
            lic = License.objects.select_related("customer").get(license_key=d["license_key"])
        except License.DoesNotExist:
            return Response({
                "valid": False,
                "reason": "License key not found.",
                "license": None,
            })

        if lic.status == "revoked":
            return Response({"valid": False, "reason": "License has been revoked.", "license": LicenseSerializer(lic).data})
        if lic.status == "suspended":
            return Response({"valid": False, "reason": "License is suspended.", "license": LicenseSerializer(lic).data})
        if lic.status == "expired":
            return Response({"valid": False, "reason": "License has expired.", "license": LicenseSerializer(lic).data})
        if lic.status == "inactive":
            return Response({"valid": False, "reason": "License has not been activated yet.", "license": LicenseSerializer(lic).data})

        if lic.expiry_date and lic.expiry_date < dj_tz.now():
            lic.status = "expired"
            lic.expired_at = dj_tz.now()
            lic.save()
            return Response({"valid": False, "reason": "License expiry date has passed.", "license": LicenseSerializer(lic).data})

        device_id = d.get("device_id")
        if device_id and lic.device_id and lic.device_id != device_id:
            return Response({"valid": False, "reason": "License is bound to a different device.", "license": LicenseSerializer(lic).data})

        return Response({
            "valid": True,
            "reason": "License is valid and active.",
            "status": lic.status,
            "license": LicenseSerializer(lic).data,
        })


# ── Expiring Soon ─────────────────────────────────────────────────────────────

class ExpiringView(APIView):
    """GET /api/licenses/expiring/<days>"""

    def get(self, request, days=30):
        qs = License.objects.select_related("customer").filter(
            status="active",
            expiry_date__isnull=False,
            expiry_date__gt=dj_tz.now(),
            expiry_date__lte=dj_tz.now() + dj_tz.timedelta(days=days),
        ).order_by("expiry_date")
        return Response(LicenseSerializer(qs, many=True).data)


# ── Audit Logs ────────────────────────────────────────────────────────────────

class AuditLogView(APIView):
    """GET /api/audit-logs?limit=100"""

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", 100))
            limit = max(1, min(limit, 500))
        except ValueError:
            limit = 100
        qs = AuditLog.objects.all()[:limit]
        return Response(AuditLogSerializer(qs, many=True).data)
