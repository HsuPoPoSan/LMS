"""
Database module - Supabase connection and CRUD operations for the licenses table.
Fields: license_key, status, device_id, activated_at, expired_at, expiry_date, customer_name
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timezone

load_dotenv()


class Database:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_KEY", "")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env file")
        self.client: Client = create_client(url, key)
        self._initialized = True

    # ─────────────────────── LICENSES ───────────────────────

    def get_licenses(self, status_filter: str = None, search: str = None) -> list:
        """Fetch all licenses with optional status filter and search."""
        query = (
            self.client.table("licenseslist")
            .select("*")
            .order("created_at", desc=True)
        )
        if status_filter and status_filter != "all":
            query = query.eq("status", status_filter)
        if search:
            query = query.or_(
                f"license_key.ilike.%{search}%,"
                f"customer_name.ilike.%{search}%,"
                f"device_id.ilike.%{search}%"
            )
        res = query.execute()
        return res.data or []

    def get_license_by_id(self, license_id: str) -> dict | None:
        res = self.client.table("licenseslist").select("*").eq("id", license_id).execute()
        return res.data[0] if res.data else None

    def get_license_by_key(self, key: str) -> dict | None:
        res = self.client.table("licenseslist").select("*").eq("license_key", key).execute()
        return res.data[0] if res.data else None

    def create_license(
        self,
        license_key: str,
        customer_name: str,
        expiry_date: str = None,
        customer_email: str = "",
        product_name: str = "General",
        license_type: str = "standard",
        max_activations: int = 1,
        notes: str = "",
    ) -> dict | None:
        payload = {
            "license_key": license_key,
            "customer_name": customer_name,
            "customer_email": customer_email,
            "product_name": product_name,
            "license_type": license_type,
            "max_activations": max_activations,
            "notes": notes,
            "status": "inactive",
        }
        if expiry_date:
            payload["expiry_date"] = expiry_date
        res = self.client.table("licenseslist").insert(payload).execute()
        if res.data:
            self._log("CREATE", res.data[0]["id"], license_key, {"customer_name": customer_name})
            return res.data[0]
        return None

    def activate_license(self, license_id: str, device_id: str) -> dict | None:
        """Bind a device to a license and mark it active."""
        now = datetime.now(timezone.utc).isoformat()
        res = (
            self.client.table("licenseslist")
            .update({
                "status": "active",
                "device_id": device_id,
                "activated_at": now,
            })
            .eq("id", license_id)
            .execute()
        )
        if res.data:
            self._log("ACTIVATE", license_id, res.data[0].get("license_key", ""), {"device_id": device_id})
            return res.data[0]
        return None

    def revoke_license(self, license_id: str) -> dict | None:
        """Revoke a license — clears device binding and sets status."""
        now = datetime.now(timezone.utc).isoformat()
        res = (
            self.client.table("licenseslist")
            .update({
                "status": "revoked",
                "expired_at": now,
            })
            .eq("id", license_id)
            .execute()
        )
        if res.data:
            self._log("REVOKE", license_id, res.data[0].get("license_key", ""), {})
            return res.data[0]
        return None

    def expire_license(self, license_id: str) -> dict | None:
        """Mark a license as expired."""
        now = datetime.now(timezone.utc).isoformat()
        res = (
            self.client.table("licenseslist")
            .update({"status": "expired", "expired_at": now})
            .eq("id", license_id)
            .execute()
        )
        if res.data:
            self._log("EXPIRE", license_id, res.data[0].get("license_key", ""), {})
            return res.data[0]
        return None

    def update_license(self, license_id: str, **kwargs) -> dict | None:
        res = self.client.table("licenseslist").update(kwargs).eq("id", license_id).execute()
        if res.data:
            self._log("UPDATE", license_id, res.data[0].get("license_key", ""), kwargs)
            return res.data[0]
        return None

    def delete_license(self, license_id: str) -> None:
        lic = self.get_license_by_id(license_id)
        self.client.table("licenseslist").delete().eq("id", license_id).execute()
        self._log("DELETE", license_id, lic.get("license_key", "") if lic else "", {})

    def get_expiring_soon(self, days: int = 30) -> list:
        """Licenses with expiry_date within the next N days."""
        from datetime import timedelta
        future = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
        now = datetime.now(timezone.utc).isoformat()
        res = (
            self.client.table("licenseslist")
            .select("*")
            .eq("status", "active")
            .lte("expiry_date", future)
            .gte("expiry_date", now)
            .order("expiry_date")
            .execute()
        )
        return res.data or []

    def validate_license_key(self, key: str, device_id: str = None) -> dict:
        """
        Validate a license key against the database.
        Optionally verify device_id binding.
        """
        lic = self.get_license_by_key(key)
        if not lic:
            return {"valid": False, "reason": "License key not found.", "license": None}

        from license_utils import check_license_validity
        result = check_license_validity(lic)
        result["license"] = lic

        if result["valid"] and device_id and lic.get("device_id"):
            if lic["device_id"] != device_id:
                result["valid"] = False
                result["reason"] = "License is bound to a different device."

        return result

    # ─────────────────────── STATS ───────────────────────

    def get_dashboard_stats(self) -> dict:
        licenses = self.client.table("licenseslist").select("status, license_type").execute().data or []
        expiring = self.get_expiring_soon(30)

        stats = {
            "total_licenses": len(licenses),
            "active_licenses": sum(1 for l in licenses if l["status"] == "active"),
            "inactive_licenses": sum(1 for l in licenses if l["status"] == "inactive"),
            "expired_licenses": sum(1 for l in licenses if l["status"] == "expired"),
            "revoked_licenses": sum(1 for l in licenses if l["status"] == "revoked"),
            "expiring_soon": len(expiring),
            "by_type": {},
        }
        for l in licenses:
            t = l.get("license_type", "unknown")
            stats["by_type"][t] = stats["by_type"].get(t, 0) + 1

        return stats

    # ─────────────────────── AUDIT LOG ───────────────────────

    def get_audit_logs(self, limit: int = 100) -> list:
        res = (
            self.client.table("audit_logs")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []

    def _log(self, action: str, license_id: str, license_key: str, details: dict) -> None:
        try:
            self.client.table("audit_logs").insert({
                "action": action,
                "license_id": str(license_id) if license_id else None,
                "license_key": license_key,
                "details": details,
                "performed_by": "admin",
            }).execute()
        except Exception:
            pass  # Don't break main flow if logging fails
