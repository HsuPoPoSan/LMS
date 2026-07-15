# ⚡ LicenseManager Pro — Full Documentation

> A Django + Django REST Framework (DRF) backend paired with a vanilla-JS frontend for managing software licenses, backed by **Supabase** as the database.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Project Structure](#2-project-structure)
3. [Prerequisites](#3-prerequisites)
4. [Environment Setup](#4-environment-setup)
5. [Database Setup (Supabase)](#5-database-setup-supabase)
6. [How to Run](#6-how-to-run)
7. [API Reference](#7-api-reference)
8. [Frontend Pages](#8-frontend-pages)
9. [Core Modules](#9-core-modules)
10. [License Key Format](#10-license-key-format)
11. [License Statuses](#11-license-statuses)
12. [Production Deployment](#12-production-deployment)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Project Overview

**LicenseManager Pro** is a full-stack web application for generating, activating, revoking, validating, and auditing software licenses. It was originally built with FastAPI and migrated to Django 5 + DRF 3.

| Layer      | Technology                        |
|------------|-----------------------------------|
| Backend    | Django 5.0.6 + DRF 3.15.2        |
| Database   | Supabase (PostgreSQL)             |
| Auth/Client| `supabase-py` SDK                 |
| Frontend   | Vanilla HTML / CSS / JavaScript   |
| Server     | Django dev server / Gunicorn      |

---

## 2. Project Structure

```
LMS/
├── manage.py                  # Django management entry point
├── start.sh                   # One-command startup script
├── requirements.txt           # Python dependencies
├── schema.sql                 # Supabase SQL schema (run once)
├── database.py                # Supabase CRUD layer (singleton)
├── license_utils.py           # Key generation & validation helpers
├── .env                       # Your secrets (never commit this)
├── .env.example               # Template for .env
│
├── lms_project/               # Django project settings package
│   ├── settings.py
│   ├── urls.py                # Root URL config (serves frontend + /api/)
│   └── wsgi.py
│
├── licenses/                  # Django app — all API views/serializers
│   ├── views.py               # DRF APIView handlers
│   ├── serializers.py         # Input validation (replaces Pydantic)
│   └── urls.py                # /api/* route definitions
│
└── frontend/                  # Static frontend (served by Django)
    ├── index.html             # Single-page app shell
    ├── app.js                 # All JS logic (API calls, UI rendering)
    └── style.css              # Styling
```

---

## 3. Prerequisites

| Requirement | Version    | Notes                         |
|-------------|------------|-------------------------------|
| Python      | ≥ 3.11     | Uses `str \| None` type hints |
| pip         | Latest     | Comes with Python             |
| Supabase    | Any plan   | Free tier works fine          |

---

## 4. Environment Setup

### Step 1 — Copy the example environment file

```bash
cp .env.example .env
```

### Step 2 — Fill in your credentials

Open `.env` and set the following values:

```dotenv
# ── Supabase ──────────────────────────────────────
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_KEY=<your-anon-or-service-role-key>

# ── License Settings ──────────────────────────────
LICENSE_SALT=LMSPro-2024-SuperSecretSalt!   # change in production

# ── Django ────────────────────────────────────────
DJANGO_SECRET_KEY=django-insecure-change-this-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# ── Server ────────────────────────────────────────
HOST=0.0.0.0
PORT=8000
```

**Where to find Supabase credentials:**

1. Log in at [https://supabase.com](https://supabase.com)
2. Open your project → **Settings** → **API**
3. Copy **Project URL** → `SUPABASE_URL`
4. Copy **anon / public key** → `SUPABASE_KEY` (or **service_role** for admin access)

---

## 5. Database Setup (Supabase)

Run `schema.sql` **once** in the Supabase SQL editor to create the required tables and functions.

### Steps

1. Open your Supabase project → **SQL Editor**
2. Paste the entire contents of `schema.sql`
3. Click **Run**

### What it creates

| Object | Description |
|---|---|
| `licenseslist` | Main table storing all license records |
| `audit_logs` | Append-only log of every license action |
| Indexes | On `license_key`, `status`, `device_id`, `expiry_date` |
| `update_updated_at_column()` | Trigger to auto-stamp `updated_at` |
| `auto_expire_licenses()` | Function to bulk-expire overdue licenses |

### `licenseslist` columns

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `license_key` | TEXT UNIQUE | The license string, e.g. `LMS-XXXXX-…` |
| `status` | TEXT | `active`, `inactive`, `expired`, `revoked`, `suspended` |
| `device_id` | TEXT | Hardware ID of the bound device |
| `activated_at` | TIMESTAMPTZ | When activation occurred |
| `expired_at` | TIMESTAMPTZ | When the license actually expired |
| `expiry_date` | TIMESTAMPTZ | Planned expiry date |
| `customer_name` | TEXT | Required |
| `customer_email` | TEXT | Optional |
| `product_name` | TEXT | Default: `General` |
| `license_type` | TEXT | `trial`, `standard`, `professional`, `enterprise` |
| `max_activations`| INTEGER | Default: `1` |
| `notes` | TEXT | Free-form notes |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

---

## 6. How to Run

### ✅ Quick Start (Recommended)

Use the included shell script — it handles everything automatically:

```bash
cd /path/to/LMS
bash start.sh
```

The script will:
1. Check that `.env` exists and credentials are set
2. Create a Python virtual environment (`.venv/`) if not present
3. Install all dependencies from `requirements.txt`
4. Launch the Django development server

**Output:**
```
⚡ LicenseManager Pro — Startup (Django)
══════════════════════════════════════════
📦 Installing dependencies…
✅ Django + DRF ready

🚀 Starting Django server on http://localhost:8000
   Dashboard: http://localhost:8000
   API:       http://localhost:8000/api/
```

Open your browser at **http://localhost:8000**

---

### Manual Start (Step-by-Step)

If you prefer to run things manually:

```bash
# 1. Enter the project directory
cd /path/to/LMS

# 2. Create a virtual environment
python3 -m venv .venv

# 3. Activate it
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\activate           # Windows

# 4. Install dependencies
pip install -r requirements.txt

# 5. (Optional) Run Django checks
python manage.py check

# 6. Start the server
python manage.py runserver 0.0.0.0:8000
```

> **Note:** This project uses Supabase as its database, so Django migrations (`makemigrations` / `migrate`) are **not required** — the schema lives in Supabase.

---

### Custom Port or Host

```bash
# Change port
PORT=9000 bash start.sh

# Change host + port
HOST=127.0.0.1 PORT=9000 bash start.sh

# Or manually
python manage.py runserver 127.0.0.1:9000
```

---

## 7. API Reference

All API endpoints are prefixed with `/api/`.

### Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Dashboard counts (total, active, expired, etc.) |

**Response:**
```json
{
  "total_licenses": 50,
  "active_licenses": 30,
  "inactive_licenses": 10,
  "expired_licenses": 5,
  "revoked_licenses": 3,
  "expiring_soon": 2,
  "by_type": { "standard": 20, "enterprise": 10 }
}
```

---

### Licenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/licenses` | List all licenses |
| `GET` | `/api/licenses?status=active` | Filter by status |
| `GET` | `/api/licenses?search=alice` | Search by key, customer, or device ID |
| `POST` | `/api/licenses` | Create a new license |
| `GET` | `/api/licenses/<id>` | Retrieve a single license |
| `PATCH` | `/api/licenses/<id>` | Partially update a license |
| `DELETE` | `/api/licenses/<id>` | Delete a license |

**POST `/api/licenses` — Request body:**

```json
{
  "customer_name": "Alice Johnson",       // required
  "customer_email": "alice@example.com",  // optional
  "product_name": "My Software",          // optional, default: "General"
  "license_type": "standard",             // optional: trial|standard|professional|enterprise
  "expiry_date": "2025-12-31",            // optional (ISO date or datetime)
  "max_activations": 1,                   // optional, default: 1
  "notes": "Internal test license",       // optional
  "custom_key": "LMS-AAAAA-BBBBB-CCCCC-DDDDD" // optional; auto-generated if omitted
}
```

---

### License Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/licenses/<id>/activate` | Bind a device and set status → `active` |
| `POST` | `/api/licenses/<id>/revoke` | Set status → `revoked` |
| `POST` | `/api/licenses/<id>/expire` | Set status → `expired` |
| `POST` | `/api/licenses/<id>/reactivate` | Reset to `inactive` (clears device binding) |

**POST `/api/licenses/<id>/activate` — Request body:**

```json
{
  "device_id": "MAC-AA:BB:CC:DD:EE:FF"  // required
}
```

---

### Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/validate` | Validate a license key |

**Request body:**
```json
{
  "license_key": "LMS-XXXXX-XXXXX-XXXXX-XXXXX",  // required
  "device_id": "MAC-AA:BB:CC:DD:EE:FF"            // optional
}
```

**Response:**
```json
{
  "valid": true,
  "reason": "License is valid and active.",
  "status": "active",
  "license": { ...full license object... }
}
```

---

### Expiring Soon

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/licenses/expiring/<days>` | Licenses expiring within N days |

**Example:** `/api/licenses/expiring/30` → licenses expiring within 30 days.

---

### Audit Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit-logs` | Last 100 audit entries |
| `GET` | `/api/audit-logs?limit=50` | Custom limit (max 500) |

---

## 8. Frontend Pages

The frontend is a single-page application served at `http://localhost:8000`.

| Page | Nav Item | Description |
|------|----------|-------------|
| **Dashboard** | 📊 Dashboard | Stats cards + expiring-soon table |
| **Licenses** | 🔑 Licenses | Full license table with filter pills & search |
| **Validate** | ✅ Validate | Enter a key + optional device ID to check validity |
| **Audit Log** | 📋 Audit Log | Timestamped log of all admin actions |

### License Table Actions

Each row in the Licenses table has an **Actions** menu:

| Button | Behavior |
|--------|----------|
| Activate | Opens modal to enter a Device ID |
| Revoke | Immediately revokes the license |
| Expire | Immediately marks the license as expired |
| Reactivate | Resets to inactive, clears device binding |
| Delete | Permanently deletes the license record |

---

## 9. Core Modules

### `database.py` — `Database` class

A **singleton** Supabase client wrapper. Instantiated once at startup and reused across all API views.

| Method | Description |
|--------|-------------|
| `get_licenses(status_filter, search)` | List licenses with optional filters |
| `get_license_by_id(id)` | Fetch single license by UUID |
| `get_license_by_key(key)` | Fetch single license by key string |
| `create_license(...)` | Insert a new license record |
| `activate_license(id, device_id)` | Bind device and set active |
| `revoke_license(id)` | Mark revoked |
| `expire_license(id)` | Mark expired |
| `update_license(id, **kwargs)` | Partial update of any field |
| `delete_license(id)` | Hard delete |
| `get_expiring_soon(days)` | Active licenses expiring within N days |
| `validate_license_key(key, device_id)` | Full validity check |
| `get_dashboard_stats()` | Aggregated status counts |
| `get_audit_logs(limit)` | Recent audit entries |

---

### `license_utils.py` — Utility Functions

| Function | Description |
|----------|-------------|
| `generate_license_key(prefix, segments, seg_len)` | Generate `LMS-XXXXX-XXXXX-XXXXX-XXXXX` |
| `validate_key_format(key)` | Regex check against pattern |
| `check_license_validity(license_data)` | Returns `{valid, reason, status}` dict |
| `mask_key(key)` | Hides middle segments for display |
| `days_until_expiry(expiry_date_str)` | Returns integer days or `None` |

---

### `licenses/views.py` — API Views

| View Class | Route | Methods |
|---|---|---|
| `StatsView` | `/api/stats` | GET |
| `LicenseListCreateView` | `/api/licenses` | GET, POST |
| `LicenseDetailView` | `/api/licenses/<id>` | GET, PATCH, DELETE |
| `LicenseActivateView` | `/api/licenses/<id>/activate` | POST |
| `LicenseRevokeView` | `/api/licenses/<id>/revoke` | POST |
| `LicenseExpireView` | `/api/licenses/<id>/expire` | POST |
| `LicenseReactivateView` | `/api/licenses/<id>/reactivate` | POST |
| `ValidateView` | `/api/validate` | POST |
| `ExpiringView` | `/api/licenses/expiring/<days>` | GET |
| `AuditLogView` | `/api/audit-logs` | GET |

---

## 10. License Key Format

Keys are generated in the format:

```
LMS-XXXXX-XXXXX-XXXXX-XXXXX
```

- **Prefix:** `LMS` (3 chars)
- **Segments:** 4 segments of 5 uppercase alphanumeric characters
- **Separator:** `-`

**Validation regex:** `^[A-Z0-9]{2,6}(-[A-Z0-9]{4,8}){3,5}$`

You can also supply a **custom key** when creating a license via the API, as long as it matches the format pattern.

---

## 11. License Statuses

| Status | Description |
|--------|-------------|
| `inactive` | Newly created, not yet activated |
| `active` | Activated and bound to a device |
| `expired` | Past `expiry_date` or manually expired |
| `revoked` | Permanently disabled by admin |
| `suspended` | Temporarily disabled (set manually) |

### Status Transition Rules

```
inactive  ──► active    (activate with device_id)
active    ──► revoked   (revoke)
active    ──► expired   (expire or auto-expire trigger)
active    ──► inactive  (reactivate — resets device binding)
revoked   ✗  cannot be re-activated via API
expired   ✗  cannot be re-activated via API
```

---

## 12. Production Deployment

### Switch to Gunicorn

The `requirements.txt` already includes `gunicorn`. To use it:

```bash
source .venv/bin/activate
gunicorn lms_project.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

### Important Production Settings (`.env`)

```dotenv
DEBUG=False
DJANGO_SECRET_KEY=<generate a long random key>
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
```

**Generate a secure Django secret key:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Serving Static Files in Production

In production with `DEBUG=False`, Django won't serve static files. Use one of:

- **WhiteNoise** (simple): `pip install whitenoise`, add to `MIDDLEWARE`
- **Nginx**: Point `/static/` at the `frontend/` directory
- **CDN**: Upload the `frontend/` assets to S3/CloudFront

### Use SUPABASE Service Role Key in Production

For server-side admin operations, use the **service_role** key (not the anon key) to bypass Row Level Security:

```dotenv
SUPABASE_KEY=<your-service-role-key>
```

> ⚠️ Never expose the `service_role` key in client-side code.

---

## 13. Troubleshooting

### `SUPABASE_URL` / `SUPABASE_KEY` errors

**Error:** `ValueError: SUPABASE_URL and SUPABASE_KEY must be set in .env file`

**Fix:** Ensure `.env` exists and has the correct values. Run:
```bash
cat .env | grep SUPABASE
```

---

### Port already in use

**Error:** `Error: That port is already in use.`

**Fix:**
```bash
# Find and kill the process using port 8000
lsof -ti:8000 | xargs kill -9

# Or use a different port
python manage.py runserver 8001
```

---

### `ModuleNotFoundError` for Django / supabase

**Fix:** Make sure the virtual environment is activated:
```bash
source .venv/bin/activate
pip install -r requirements.txt
```

---

### Frontend not loading (404 on `/static/`)

**Fix:** Ensure `STATICFILES_DIRS` in `settings.py` points to the `frontend/` folder, and that `DEBUG=True` for development.

---

### `409 Conflict` when creating a license

**Cause:** A license with that key already exists in the database.

**Fix:** Leave the `custom_key` field blank to let the server auto-generate a unique key.

---

### Supabase `audit_logs` table missing

**Fix:** Re-run `schema.sql` in the Supabase SQL Editor. It uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times.

---

*Documentation version: 2.0.0 — Django edition*
