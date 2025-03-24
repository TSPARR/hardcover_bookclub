#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

cd /app

# Install dependencies with explicit gunicorn installation
echo "Installing dependencies..."
pip install -r requirements.txt
pip install gunicorn==22.0.0  # Explicitly install gunicorn

# Ensure ALL directories exist
echo "Creating directories..."
mkdir -p /app/logs /app/staticfiles /app/media /app/static

# Run migrations
echo "Running migrations..."
python manage.py migrate

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start server with full path
echo "Starting gunicorn server..."
/usr/local/bin/gunicorn hardcover_bookclub.wsgi:application --bind 0.0.0.0:8000