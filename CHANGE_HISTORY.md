# 📝 CHANGE HISTORY — LicenseManager Pro

> Track every prompt, change, error, and fix in this project.
> Format: Prompt → Changes → Errors → Solutions

---

## Table of Contents
- [v1.0.0 — Initial Build](#v100--initial-build-2026-05-11)
- [v1.1.0 — Full-Stack Rebuild](#v110--full-stack-rebuild-2026-05-16)
- [v1.2.0 — Change History File](#v120--change-history-file-2026-05-16)
- [v1.3.0 — Table Rename](#v130--table-rename-licenses--licenseslist-2026-05-16)
- [v2.0.0 — Migrate FastAPI → Django](#v200--migrate-fastapi--django-2026-05-25)
- [Ongoing Error Log](#-ongoing-error-log)
- [How to Update This File](#-how-to-update-this-file)

---

## v1.0.0 — Initial Build (2026-05-11)

### 📅 Date
`2026-05-11` — Conversation IDs: `43063088`, `10b98ecc`

### 💬 Prompt
> *"create license management system with python and supabase"*

### 🔧 What Changed
| File | Action | Description |
|------|--------|-------------|
| `schema.sql` | Created | Multi-table schema: `products`, `customers`, `licenses`, `activations`, `audit_logs` |
| `database.py` | Created | Python Supabase CRUD class (singleton pattern) with products, customers, licenses, activations |
| `license_utils.py` | Created | License key generation (`generate_license_key`, `generate_signed_key`), HMAC validation, masking |
| `requirements.txt` | Created | `supabase`, `python-dotenv`, `cryptography`, `customtkinter`, `qrcode`, `reportlab` |
| `.env.example` | Created | `SUPABASE_URL`, `SUPABASE_KEY` template |

### ❌ Errors Encountered
| # | Error | File | Cause |
|---|-------|------|-------|
| 1 | `ValueError: SUPABASE_URL and SUPABASE_KEY must be set` | `database.py` | `.env` file not created before running |
| 2 | `ModuleNotFoundError: No module named 'supabase'` | — | Dependencies not installed before running |
| 3 | `ImportError: cryptography` version mismatch | `license_utils.py` | System Python conflicting with venv |

### ✅ How Errors Were Solved
| # | Solution |
|---|---------|
| 1 | Copy `.env.example` → `.env` and fill in Supabase credentials from the Supabase dashboard → Settings → API |
| 2 | Run `pip install -r requirements.txt` inside an activated virtual environment |
| 3 | Always use `python3 -m venv .venv && source .venv/bin/activate` before installing packages |

---

## v1.1.0 — Full-Stack Rebuild (2026-05-16)

### 📅 Date
`2026-05-16 14:10` (+06:30) — Conversation ID: `03bbfac7`

### 💬 Prompt
> *"create license management system with python, javascript and database supabase will be used, to manage license for other license product, to connect table, licenses, in that table, license_key, status, device_id, activated_at, expired_at, expiry_date, customer_name"*

### 🔧 What Changed

#### New / Replaced Files
| File | Action | Description |
|------|--------|-------------|
| `schema.sql` | **Replaced** | Simplified to single `licenses` table with all required fields: `license_key`, `status`, `device_id`, `activated_at`, `expired_at`, `expiry_date`, `customer_name` + extended fields. Added `audit_logs` table, indexes, auto-expire function |
| `database.py` | **Replaced** | Rebuilt around the new `licenses` table; added `activate_license()`, `revoke_license()`, `expire_license()`, `validate_license_key()`, `get_expiring_soon()`, `get_dashboard_stats()` |
| `license_utils.py` | **Replaced** | Removed HMAC signed key (complexity); kept `generate_license_key()`, `validate_key_format()`, `check_license_validity()`, `days_until_expiry()`, `mask_key()` |
| `requirements.txt` | **Replaced** | Changed from `customtkinter` desktop app → `fastapi`, `uvicorn` REST API |
| `main.py` | **Created** | FastAPI app with 14 REST endpoints: CRUD, activate, revoke, expire, reactivate, validate, stats, audit-log, expiring-soon. Serves frontend via `StaticFiles` |
| `frontend/index.html` | **Created** | 4-page SPA: Dashboard, Licenses, Validate, Audit Log |
| `frontend/style.css` | **Created** | Dark glassmorphism theme, vibrant accent colors, micro-animations, responsive layout |
| `frontend/app.js` | **Created** | Vanilla JS: routing, API calls, license CRUD, activate modal, validate page, audit log, toast notifications, XSS-safe rendering |
| `start.sh` | **Created** | Bash startup script — checks `.env`, creates venv, installs deps, runs uvicorn |
| `README.md` | **Created** | Full documentation: setup, API reference, table schema, feature list |

#### Key Design Decisions
- **Single `licenses` table** instead of `products` + `customers` + `licenses` (simpler, as requested)
- **FastAPI** chosen for Python REST backend (automatic OpenAPI docs at `/docs`)
- **Vanilla JS** (no frameworks) for frontend — served by FastAPI `StaticFiles`
- **Device binding**: `activate_license()` sets `device_id` + `activated_at`; `revoke_license()` sets `expired_at`
- **Status flow**: `inactive → active` (on activate) → `expired`/`revoked` (on action)

### ❌ Errors Encountered
| # | Error | File | Cause |
|---|-------|------|-------|
| 1 | `ModuleNotFoundError: No module named 'fastapi'` | `main.py` | Old `requirements.txt` didn't include FastAPI |
| 2 | `StaticFiles` raises `RuntimeError` if `frontend/` folder missing | `main.py` | Running server before creating `frontend/` directory |
| 3 | `supabase.or_()` filter syntax error | `database.py` | `or_()` filter format changed between supabase-py versions |
| 4 | `CORS` error in browser when calling `/api/*` | `main.py` | Frontend on port 5500 calling API on port 8000 during dev |
| 5 | `422 Unprocessable Entity` on `PATCH /api/licenses/{id}` | `main.py` | Sending `null` fields in JSON body; Pydantic rejected them |
| 6 | `int \| None` type hint syntax error on Python < 3.10 | `license_utils.py` | `int \| None` union syntax requires Python 3.10+ |

### ✅ How Errors Were Solved
| # | Solution |
|---|---------|
| 1 | Updated `requirements.txt` to include `fastapi==0.111.0` and `uvicorn[standard]==0.30.1`; re-run `pip install -r requirements.txt` |
| 2 | `start.sh` checks for the folder, but the issue is prevented because `main.py` wraps `StaticFiles` in `if os.path.isdir("frontend")` |
| 3 | Changed `query.or_()` to use correct Supabase PostgREST `or_` string format: `f"license_key.ilike.%{search}%,customer_name.ilike.%{search}%"` |
| 4 | Added `CORSMiddleware` to FastAPI app with `allow_origins=["*"]`; or serve everything from port 8000 (FastAPI also serves the frontend via `StaticFiles`) |
| 5 | Used `{k: v for k, v in body.model_dump().items() if v is not None}` to filter out `None` values before passing to `update_license()` |
| 6 | Changed `int \| None` to `Optional[int]` from `typing` module for compatibility with Python 3.8/3.9 |

---

## v1.2.0 — Change History File (2026-05-16)

### 📅 Date
`2026-05-16 14:20` (+06:30)

### 💬 Prompt
> *"make the change history file, in that file there will be what prompt, what change, when change, what error, how to solve that error"*

### 🔧 What Changed
| File | Action | Description |
|------|--------|-------------|
| `CHANGE_HISTORY.md` | **Created** | This file — tracks all prompts, changes, errors, and fixes |

### ❌ Errors Encountered
_None — documentation-only change._

### ✅ How Errors Were Solved
_N/A_

---

## v1.3.0 — Table Rename: `licenses` → `licensesList` (2026-05-16)

### 📅 Date
`2026-05-16 14:28` (+06:30)

### 💬 Prompt
> *"make the table name license to licensesList"*

### 🔧 What Changed
| File | Action | Lines Changed | Description |
|------|--------|---------------|-------------|
| `schema.sql` | Modified | 12, 39, 49–53, 67–69, 80, 95 | Renamed `CREATE TABLE licenses` → `licensesList`; updated FK reference in `audit_logs`, all index `ON` clauses, trigger `ON` clause, `UPDATE` statement, `INSERT INTO` |
| `database.py` | Modified | 37, 53, 57, 83, 93, 111, 128, 139, 147, 156, 189 | All `.table("licenses")` → `.table("licensesList")` (11 occurrences, auto-replaced with `sed`) |

### ❌ Errors Encountered
_None — straightforward rename, no runtime errors._

### ✅ How Errors Were Solved
_N/A_

> ⚠️ **If you already ran `schema.sql` in Supabase** before this change, you must run the following migration in the Supabase SQL Editor:
> ```sql
> ALTER TABLE licenses RENAME TO licensesList;
> ```
> Otherwise, drop the old table and re-run the full `schema.sql`.

---

## v2.0.0 — Migrate FastAPI → Django (2026-05-25)

### 📅 Date
`2026-05-25 20:42` (+06:30) — Conversation ID: `51b3ab67`

### 💬 Prompt
> *"change the python framework to django"*

### 🔧 What Changed

#### New Files Created
| File | Action | Description |
|------|--------|-------------|
| `manage.py` | **Created** | Django CLI entry point — replaces `uvicorn main:app` |
| `lms_project/__init__.py` | **Created** | Django project package marker |
| `lms_project/settings.py` | **Created** | Django settings: `INSTALLED_APPS`, `REST_FRAMEWORK`, `CORS`, `STATICFILES`, `APPEND_SLASH=False` |
| `lms_project/urls.py` | **Created** | Root URL router: `/` → frontend HTML, `/api/` → licenses app |
| `lms_project/wsgi.py` | **Created** | WSGI entry point for production (gunicorn) |
| `licenses/__init__.py` | **Created** | `licenses` Django app package marker |
| `licenses/views.py` | **Created** | 11 DRF `APIView` classes replacing all 14 FastAPI route handlers |
| `licenses/serializers.py` | **Created** | 4 DRF `Serializer` classes replacing Pydantic models (`LicenseCreateSerializer`, `LicenseUpdateSerializer`, `ActivateSerializer`, `ValidateSerializer`) |
| `licenses/urls.py` | **Created** | URL patterns for all `/api/*` routes |
| `pyrefly.toml` | **Created** | Pyrefly type-checker config pointing at `.venv` site-packages |
| `.vscode/settings.json` | **Created** | VSCode Python interpreter set to `.venv/bin/python` |

#### Modified Files
| File | Action | Description |
|------|--------|-------------|
| `requirements.txt` | **Replaced** | `fastapi`, `uvicorn`, `pydantic` → `django`, `djangorestframework`, `django-cors-headers`, `gunicorn`; added `django-stubs`, `djangorestframework-stubs` |
| `start.sh` | **Updated** | Changed launcher from `uvicorn main:app --reload` → `python manage.py runserver` |
| `.env` / `.env.example` | **Updated** | Added `DJANGO_SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` variables |
| `license_utils.py` | **Updated** | Fixed type hint: `days_until_expiry(str)` → `days_until_expiry(str \| None)` |

#### Archived / Removed
| File | Action | Description |
|------|--------|-------------|
| `main.py` | **Renamed** → `main.py.fastapi.bak` | Old FastAPI app kept as backup |

#### Key Design Decisions
- **`APPEND_SLASH = False`** — DRF routes kept without trailing slashes to match the existing frontend `fetch()` calls
- **`UNAUTHENTICATED_USER = None`** — disables DRF's `AnonymousUser` lookup; no Django auth DB is needed since Supabase handles all data
- **`DATABASES = {}`** — Django ORM not used; all DB access goes through the existing `database.py` Supabase client (no migrations needed)
- **`django.contrib.auth` in `INSTALLED_APPS`** — required by DRF internals even though we don't use Django's auth system
- **Kept `database.py` and `license_utils.py` unchanged** — they are fully framework-agnostic

### ❌ Errors Encountered
| # | Error | File | Cause |
|---|-------|------|-------|
| 1 | `Cannot find module rest_framework` | `licenses/serializers.py` | IDE using system Python instead of `.venv`; `rest_framework` only in venv |
| 2 | `404 Not Found` on all `/api/*` routes | server | Django `APPEND_SLASH=True` (default) redirected `/api/stats` → `/api/stats/` but URL patterns had no trailing slash |
| 3 | `RuntimeError: Model class Permission doesn't declare app_label` | server | DRF's `UNAUTHENTICATED_USER` defaults to `AnonymousUser`, which imports `django.contrib.auth`, but `auth` was missing from `INSTALLED_APPS` |
| 4 | `Argument dict\|None not assignable to parameter lic with type dict` | `licenses/views.py:L163` | `_enrich()` typed as `(dict) → dict` but DB methods return `dict \| None` |
| 5 | `Argument Unknown\|None not assignable to parameter expiry_date_str with type str` | `licenses/views.py:L27` | `days_until_expiry()` signature said `str` but `dict.get()` returns `str \| None` |
| 6 | `Cannot find type stubs for module django.urls` | `licenses/urls.py` | Django doesn't ship type stubs; Pyrefly needs `django-stubs` package |

### ✅ How Errors Were Solved
| # | Solution |
|---|---------|
| 1 | Created `.vscode/settings.json` with `python.defaultInterpreterPath` pointing to `.venv/bin/python`; created `pyrefly.toml` with `site_package_path = [".venv/lib/python3.12/site-packages"]` |
| 2 | Added `APPEND_SLASH = False` to `lms_project/settings.py` |
| 3 | Added `"django.contrib.auth"` to `INSTALLED_APPS` and set `"UNAUTHENTICATED_USER": None` in `REST_FRAMEWORK` settings |
| 4 | Updated `_enrich()` signature to `(dict \| None) → dict \| None` — the `if lic:` guard was already there, just the type hint was wrong |
| 5 | Updated `days_until_expiry(expiry_date_str: str)` → `(expiry_date_str: str \| None)` in `license_utils.py` — function body already handled `None` |
| 6 | Ran `pip install django-stubs djangorestframework-stubs`; added both to `requirements.txt`; added `use_untyped_imports = true` to `pyrefly.toml` |

---

## 🐛 Ongoing Error Log

> Add new errors here as you encounter them during development.

| Date | Error Message | File | Root Cause | Solution | Status |
|------|--------------|------|------------|----------|--------|
| 2026-05-16 | `SUPABASE_URL...must be set` | `database.py` | `.env` not configured | Copy `.env.example` → `.env`, fill credentials | ✅ Fixed |
| 2026-05-16 | `uv install` running in background | terminal | `uv` package manager install script | Wait for install to complete; alternatively use `pip` directly | ⏳ Pending |
| 2026-05-16 | `Cannot find module fastapi.middleware.cors` | `main.py` | IDE (Pylance) scanning system Python, not `.venv`; FastAPI not installed system-wide | 1) `Ctrl+Shift+P` → "Python: Select Interpreter" → pick `.venv/bin/python`; 2) Run `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt` | ✅ Fixed |
| — | _(add new errors here)_ | — | — | — | — |

---

## 📋 How to Update This File

When you make a change, add a new section following this template:

```markdown
## v1.X.0 — Short Description (YYYY-MM-DD)

### 📅 Date
`YYYY-MM-DD HH:MM` (+TZ)

### 💬 Prompt
> *"exact words used to request the change"*

### 🔧 What Changed
| File | Action | Description |
|------|--------|-------------|
| `filename.py` | Created / Modified / Deleted | What was done |

### ❌ Errors Encountered
| # | Error | File | Cause |
|---|-------|------|-------|
| 1 | `ErrorType: message` | `file.py` | Why it happened |

### ✅ How Errors Were Solved
| # | Solution |
|---|---------|
| 1 | Step-by-step fix |
```

---

*Last updated: 2026-05-25 by Antigravity AI*
