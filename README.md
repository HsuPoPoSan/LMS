# 🔑 LicenseManager Pro

A full-stack **License Management System** built with:
- **Python** (Django + Django REST Framework backend)
- **JavaScript** (Vanilla JS frontend dashboard)
- **Supabase** (PostgreSQL database)

---

## 📁 Project Structure

```
LMS/
├── manage.py                  # Django CLI entry point
├── lms_project/               # Django project package
│   ├── settings.py            # App settings (DB, DRF, CORS, static files)
│   ├── urls.py                # Root URL router
│   └── wsgi.py                # WSGI entry point (for gunicorn in production)
├── licenses/                  # Django app — all license logic
│   ├── views.py               # DRF APIView classes (11 endpoints)
│   ├── serializers.py         # DRF Serializers (input validation)
│   └── urls.py                # /api/* URL patterns
├── database.py                # Supabase CRUD layer (framework-agnostic)
├── license_utils.py           # Key generation & validation utilities
├── requirements.txt           # Python dependencies
├── schema.sql                 # Supabase database schema
├── start.sh                   # One-command startup script
├── .env.example               # Environment variable template
├── pyrefly.toml               # Type-checker config (Pyrefly/Pylance)
├── .vscode/settings.json      # VSCode Python interpreter config
└── frontend/
    ├── index.html             # SPA dashboard
    ├── style.css              # Dark glassmorphism theme
    └── app.js                 # Vanilla JS application logic
```

---

## 🗄️ Database Schema — `licenseslist` Table

| Column            | Type        | Description                                              |
|-------------------|-------------|----------------------------------------------------------|
| `id`              | UUID (PK)   | Auto-generated primary key                               |
| `license_key`     | TEXT UNIQUE | License key (e.g. `LMS-XXXXX-XXXXX-XXXXX-XXXXX`)        |
| `status`          | TEXT        | `active`, `inactive`, `expired`, `revoked`, `suspended`  |
| `device_id`       | TEXT        | Device bound to the license                              |
| `activated_at`    | TIMESTAMPTZ | When the license was activated                           |
| `expired_at`      | TIMESTAMPTZ | When it actually expired                                 |
| `expiry_date`     | TIMESTAMPTZ | Planned expiry / validity end date                       |
| `customer_name`   | TEXT        | Customer's name                                          |
| `customer_email`  | TEXT        | Customer's email (optional)                              |
| `product_name`    | TEXT        | Software product name                                    |
| `license_type`    | TEXT        | `trial`, `standard`, `professional`, `enterprise`        |
| `max_activations` | INTEGER     | Max allowed device activations                           |
| `notes`           | TEXT        | Optional notes                                           |
| `created_at`      | TIMESTAMPTZ | Record creation timestamp                                |
| `updated_at`      | TIMESTAMPTZ | Auto-updated on change                                   |

---

## ⚙️ Setup

### 1. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `schema.sql`
3. Copy your **Project URL** and **anon/service_role key**

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key

# Django
DJANGO_SECRET_KEY=change-this-to-a-long-random-string
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
```

### 3. Install & Run

**Quick start (auto setup):**
```bash
chmod +x start.sh
./start.sh
```

**Manual:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py runserver
```

**Production (gunicorn):**
```bash
source .venv/bin/activate
gunicorn lms_project.wsgi:application --bind 0.0.0.0:8000
```

Open **http://localhost:8000** in your browser.

---

## 🌐 API Endpoints

All endpoints are under `/api/` and return JSON. No trailing slash required.

| Method   | Endpoint                              | Description                    |
|----------|---------------------------------------|--------------------------------|
| `GET`    | `/api/stats`                          | Dashboard statistics           |
| `GET`    | `/api/licenses`                       | List all licenses              |
| `GET`    | `/api/licenses?status=active`         | Filter by status               |
| `GET`    | `/api/licenses?search=alice`          | Search by key/customer/device  |
| `POST`   | `/api/licenses`                       | Create new license             |
| `GET`    | `/api/licenses/<id>`                  | Get single license             |
| `PATCH`  | `/api/licenses/<id>`                  | Update license metadata        |
| `DELETE` | `/api/licenses/<id>`                  | Delete license permanently     |
| `POST`   | `/api/licenses/<id>/activate`         | Activate with device_id        |
| `POST`   | `/api/licenses/<id>/revoke`           | Revoke license                 |
| `POST`   | `/api/licenses/<id>/expire`           | Mark as expired                |
| `POST`   | `/api/licenses/<id>/reactivate`       | Reset to inactive              |
| `POST`   | `/api/validate`                       | Validate a license key         |
| `GET`    | `/api/audit-logs`                     | Audit log entries              |
| `GET`    | `/api/licenses/expiring/<days>`       | Licenses expiring in N days    |

### Example: Create a License
```bash
curl -X POST http://localhost:8000/api/licenses \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Alice Johnson",
    "customer_email": "alice@example.com",
    "product_name": "PhotoEditor Pro",
    "license_type": "professional",
    "expiry_date": "2027-01-01T00:00:00Z"
  }'
```

### Example: Validate a License Key
```bash
curl -X POST http://localhost:8000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"license_key": "LMS-XXXXX-XXXXX-XXXXX-XXXXX", "device_id": "MAC-AA:BB:CC"}'
```

---

## 🏗️ Architecture

```
Browser / Frontend (Vanilla JS)
        │
        ▼
Django (manage.py runserver / gunicorn)
  ├── lms_project/urls.py       ← routes / → index.html, /api/ → licenses app
  ├── licenses/urls.py          ← all /api/* patterns
  ├── licenses/views.py         ← DRF APIView classes
  ├── licenses/serializers.py   ← input validation (replaces Pydantic)
  └── database.py               ← Supabase client (no Django ORM)
        │
        ▼
Supabase (PostgreSQL)
  └── licenseslist table
```

> **No Django ORM / migrations** — all database access goes directly through
> the `database.py` Supabase client. `DATABASES = {}` is intentionally empty.

---

## ✨ Features

- 🔑 **Auto license key generation** (`LMS-XXXXX-XXXXX-XXXXX-XXXXX`)
- ⚡ **Device binding** — lock a license to a specific device ID
- 🛡️ **Validation API** — check key validity + device match
- 📊 **Live dashboard** with real-time stats
- ⏰ **Expiry tracking** — warns on licenses expiring within 30 days
- 📋 **Full audit log** of all actions
- 🎨 **Premium dark UI** with glassmorphism and micro-animations
- 🦺 **Django REST Framework** — robust serializer validation, clean APIViews
- 🌐 **CORS enabled** — safe cross-origin requests out of the box

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `django` | Web framework |
| `djangorestframework` | REST API layer (views, serializers, responses) |
| `django-cors-headers` | CORS middleware |
| `supabase` | Supabase Python client |
| `python-dotenv` | Load `.env` variables |
| `cryptography` | Used by `license_utils.py` |
| `gunicorn` | Production WSGI server |
| `django-stubs` | Type stubs for IDE (Pyrefly/Pylance) |
| `djangorestframework-stubs` | Type stubs for DRF |

---

*Last updated: 2026-05-25 — v2.0.0 (Django migration)*
