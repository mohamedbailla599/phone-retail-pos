#!/bin/sh
set -e

echo "==> Waiting for PostgreSQL at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
while ! python -c "import socket; s = socket.socket(); s.connect(('${POSTGRES_HOST:-db}', int('${POSTGRES_PORT:-5432}'))); s.close()" 2>/dev/null; do
    sleep 1
done
echo "==> PostgreSQL is ready!"

echo "==> Running migrations..."
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput

echo "==> Ensuring initial store database and guaranteed admin credentials..."
python manage.py ensure_initial_setup

echo "==> Starting Daphne ASGI server on port 8000..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
