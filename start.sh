#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  LicenseManager Pro — start.sh
#  Installs deps, runs migrations, creates default admin, starts server
# ═══════════════════════════════════════════════════════════════

set -e

VENV=".venv"
PYTHON="python3"

echo ""
echo "⚡ LicenseManager Pro — Startup (Django)"
echo "══════════════════════════════════════════"

# ── Load .env ────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "📋 Created .env from .env.example"
    echo "   ⚠️  Fill in your DB_HOST and DB_PASSWORD before running!"
    echo ""
  fi
fi

source .env 2>/dev/null || true

# Check database credentials
if [ -z "$DB_PASSWORD" ] && [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: Set DB_PASSWORD (and DB_HOST) or DATABASE_URL in your .env file."
  echo "   See .env.example for the required variables."
  exit 1
fi

# ── Virtual env ──────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
  echo "🐍 Creating virtual environment…"
  $PYTHON -m venv "$VENV"
fi

source "$VENV/bin/activate"

echo "📦 Installing dependencies…"
pip install -q -r requirements.txt

# ── Migrations ───────────────────────────────────────────────
echo "🗄️  Running database migrations…"
python manage.py migrate -v 0

# ── Default admin ────────────────────────────────────────────
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@lms.local', 'admin123')
    print('✅ Default admin created  →  username: admin  |  password: admin123')
else:
    print('ℹ️  Admin user already exists')
" 2>/dev/null

echo ""
echo "✅ Django + DRF ready"
echo ""

HOST_VAR="${HOST:-0.0.0.0}"
PORT_VAR="${PORT:-8000}"

echo "🚀 Starting Django server on http://localhost:${PORT_VAR}"
echo "   Dashboard: http://localhost:${PORT_VAR}"
echo "   API:       http://localhost:${PORT_VAR}/api/"
echo ""

python manage.py runserver "${HOST_VAR}:${PORT_VAR}"
