"""
Django settings for LicenseManager Pro
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-lms-pro-change-this-in-production-2024!")

DEBUG = os.getenv("DEBUG", "True") == "True"

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0").split(",")

# ── Installed Apps ─────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "licenses",
    "users",
]

# ── Middleware ─────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]

ROOT_URLCONF = "lms_project.urls"

APPEND_SLASH = False

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "frontend"],
        "APP_DIRS": False,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "lms_project.wsgi.application"

# ── Database — Supabase PostgreSQL ─────────────────────────────────────────
#
# Supabase exposes a direct Postgres connection.
# In your Supabase dashboard → Settings → Database → Connection string
# Copy the "URI" value and set it as DATABASE_URL in .env, OR
# set the individual DB_* variables below.
#
# Direct connection (for long-lived processes / local dev):
#   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
#
# Supabase Transaction Pooler (recommended for serverless / hosted):
#   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

_db_url = os.getenv("DATABASE_URL", "")

if _db_url:
    # Parse DATABASE_URL if provided (e.g. on Railway / Render / Heroku)
    import urllib.parse as _up
    _u = _up.urlparse(_db_url)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME":     _u.path.lstrip("/"),
            "USER":     _u.username,
            "PASSWORD": _u.password,
            "HOST":     _u.hostname,
            "PORT":     str(_u.port or 5432),
            "OPTIONS":  {"sslmode": os.getenv("DB_SSLMODE", "require")},
        }
    }
else:
    # Individual env vars (preferred for Supabase)
    DATABASES = {
        "default": {
            "ENGINE":   "django.db.backends.postgresql",
            "NAME":     os.getenv("DB_NAME",     "postgres"),
            "USER":     os.getenv("DB_USER",     "postgres"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST":     os.getenv("DB_HOST",     ""),
            "PORT":     os.getenv("DB_PORT",     "5432"),
            "OPTIONS":  {"sslmode": os.getenv("DB_SSLMODE", "require")},
        }
    }

# ── Static Files ───────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "frontend"]

# ── CORS ───────────────────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True

# ── REST Framework ─────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# ── Supabase (only needed if using SDK for Realtime/Storage/Edge) ──────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# ── App settings ───────────────────────────────────────────────────────────
APP_NAME    = os.getenv("APP_NAME",    "LicenseManager Pro")
APP_VERSION = os.getenv("APP_VERSION", "2.0.0")

USE_TZ = True   # Required: Supabase columns are TIMESTAMPTZ

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
