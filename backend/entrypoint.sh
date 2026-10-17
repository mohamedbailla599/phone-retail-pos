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

# Auto-load initial fixture if DB has no users and fixture exists
if [ -f "fixtures/initial_data.json" ]; then
    USER_COUNT=$(python -c "import os, django; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings'); django.setup(); from apps.users.models import User; print(User.objects.count())" 2>/dev/null || echo "0")
    if [ "$USER_COUNT" = "0" ]; then
        echo "==> Fresh database detected. Loading initial store data fixture..."
        python manage.py loaddata fixtures/initial_data.json || echo "Initial data load warning"
    fi
fi

echo "==> Starting Daphne ASGI server on port 8000..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
