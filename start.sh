#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
#  LicenseManager Pro — start.sh
#  Sets up venv, installs deps, and launches the Django server
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

# Check that credentials are set
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

echo ""
echo "✅ Django + DRF ready"
echo ""

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

echo "🚀 Starting Django server on http://localhost:$PORT"
echo "   Dashboard: http://localhost:$PORT"
echo "   API:       http://localhost:$PORT/api/"
echo ""

# Use Django's dev server (switch to gunicorn for production)
python manage.py runserver "$HOST:$PORT"
