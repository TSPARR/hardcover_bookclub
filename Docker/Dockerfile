# Use the official Python image from the Docker Hub
FROM python:3.11-slim

# attach to github repo
LABEL org.opencontainers.image.source https://github.com/TSPARR/hardcover_bookclub

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Set the working directory
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt /app/

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn==22.0.0

# Copy the rest of the application code into the container
COPY . /app/

# Ensure directories exist
RUN mkdir -p /app/logs /app/staticfiles /app/media /app/static

# Run migrations
RUN python manage.py migrate

# Admin credentials from environment variables or defaults
ENV DJANGO_ADMIN_USERNAME=admin
ENV DJANGO_ADMIN_EMAIL=admin@example.com
ENV DJANGO_ADMIN_PASSWORD=adminpassword

# Create superuser if needed (won't create if user already exists)
RUN python /app/superuser.py

# Set admin user to admin group
RUN python manage.py set_group_admin $DJANGO_ADMIN_USERNAME || echo "Could not set admin group - command may not exist or user not found"

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose the port the app runs on
EXPOSE 8000

# Start gunicorn server
CMD ["gunicorn", "hardcover_bookclub.wsgi:application", "--bind", "0.0.0.0:8000", "--timeout", "120", "--workers", "2"]