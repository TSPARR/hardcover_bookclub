#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

cd /app
echo "Current directory: $(pwd)"

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Ensure directories exist
echo "Creating directories..."
mkdir -p /app/logs /app/staticfiles /app/media /app/static

# Run migrations
echo "Running migrations..."
python manage.py migrate

# Admin credentials from environment variables or defaults
ADMIN_USERNAME=${DJANGO_ADMIN_USERNAME:-admin}
ADMIN_EMAIL=${DJANGO_ADMIN_EMAIL:-admin@example.com}
ADMIN_PASSWORD=${DJANGO_ADMIN_PASSWORD:-adminpassword}

# Create superuser if needed (won't create if user already exists)
echo "Checking for admin user..."
python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hardcover_bookclub.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
username = '$ADMIN_USERNAME'
email = '$ADMIN_EMAIL'
password = '$ADMIN_PASSWORD'
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, password)
    print(f'Superuser {username} created')
else:
    print(f'Superuser {username} already exists')
"

# Set admin user to admin group
echo "Setting admin group..."
python manage.py set_group_admin $ADMIN_USERNAME || echo "Could not set admin group - command may not exist or user not found"

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start gunicorn server
echo "Starting gunicorn server..."
python -m gunicorn hardcover_bookclub.wsgi:application --bind 0.0.0.0:8000 --timeout 120 --workers 2