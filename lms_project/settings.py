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
    "django.contrib.auth",          # required by DRF internals
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "licenses",
]

# ── Middleware ─────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "lms_project.urls"

# Don't redirect /api/foo → /api/foo/ — keep parity with FastAPI-style URLs
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

# ── Database (not used — we connect to Supabase directly) ─────────────────
DATABASES = {}

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
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [],
    # Disable AnonymousUser lookup — no Django auth DB needed
    "UNAUTHENTICATED_USER": None,
}

# ── Supabase (read by database.py) ─────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# ── App settings ───────────────────────────────────────────────────────────
APP_NAME = os.getenv("APP_NAME", "LicenseManager Pro")
APP_VERSION = os.getenv("APP_VERSION", "2.0.0")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
