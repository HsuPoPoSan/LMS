#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
#  LicenseManager Pro — start.sh
#  Sets up venv, installs deps, runs migrations, launches server
# ════════════════════════════════════════════════════════════

set -e

VENV=".venv"
PYTHON="python3"

echo ""
echo "⚡ LicenseManager Pro — Startup (Django)"
echo "══════════════════════════════════════════"

# ── Check .env ───────────────────────────────────────────────
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "📋 Created .env from .env.example"
    echo "   ⚠️  Fill in your SUPABASE_URL and SUPABASE_KEY before running!"
    echo ""
  fi
fi

source .env 2>/dev/null || true
if [[ "$SUPABASE_URL" == *"your-project-id"* ]] || [ -z "$SUPABASE_URL" ]; then
  echo "❌ ERROR: Please set SUPABASE_URL in your .env file."
  exit 1
fi
if [[ "$SUPABASE_KEY" == *"your-anon"* ]] || [ -z "$SUPABASE_KEY" ]; then
  echo "❌ ERROR: Please set SUPABASE_KEY in your .env file."
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
python manage.py migrate --run-syncdb -v 0 2>/dev/null || python manage.py migrate -v 0

# ── Default admin user ───────────────────────────────────────
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

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

echo "🚀 Starting Django server on http://localhost:$PORT"
echo "   Dashboard: http://localhost:$PORT"
echo "   API:       http://localhost:$PORT/api/"
echo ""

python manage.py runserver "$HOST:$PORT"
