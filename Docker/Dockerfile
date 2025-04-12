# Use the official Python image from the Docker Hub
FROM python:3.11-slim

# attach to github repo
LABEL org.opencontainers.image.source=https://github.com/TSPARR/hardcover_bookclub

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Set the working directory
WORKDIR /app

# Upgrade pip
RUN pip install --upgrade pip wheel setuptools

# Copy the requirements file into the container
COPY requirements.txt /app/

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . /app/

# Ensure directories exist
RUN mkdir -p /app/logs /app/staticfiles /app/media /app/static

# make start command executable
RUN chmod +x /app/start.sh

# Expose the port the app runs on
EXPOSE 8000

# Start gunicorn server
CMD ["bash", "-c", "/app/start.sh"]