#!/usr/bin/env bash
# Legt .env an und würfelt alle Zugangsdaten aus.
# Eine vorhandene .env wird nicht angefasst.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env existiert bereits - es wird nichts ueberschrieben."
  echo "Neu erzeugen? Erst 'rm .env' ausfuehren."
  exit 0
fi

rand() { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1"; }

cp .env.example .env

# In-place-Ersetzung portabel fuer macOS (BSD sed) und Linux (GNU sed).
set_value() {
  local key="$1" value="$2"
  if sed --version >/dev/null 2>&1; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    sed -i '' "s|^${key}=.*|${key}=${value}|" .env
  fi
}

set_value POSTGRES_PASSWORD "$(rand 32)"
set_value ADMIN_PASSWORD "$(rand 24)"
set_value SESSION_SECRET "$(rand 48)"

chmod 600 .env

echo "OK - .env angelegt (Dateirechte 600)."
echo
echo "Das Admin-Passwort steht in .env. Anzeigen mit:"
echo "  grep ADMIN_PASSWORD .env"
echo
echo "Die Datei ist ueber .gitignore vom Repository ausgeschlossen."
