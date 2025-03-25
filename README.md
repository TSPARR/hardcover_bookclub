# 📚 Hardcover Bookclub

## 📝 Description

Hardcover Bookclub is a self-hosted application that integrates seamlessly with the Hardcover.app API. It allows users to create and manage book entries, leave comments, engage in discussions, and track their reading progress—all within the application. This project aims to provide a comprehensive platform for book enthusiasts to connect and share their reading experiences.

### 🔑 Key Features:
- **Book Management**: Create and manage book entries with ease.
- **Comments and Discussions**: Leave comments and engage in discussions about your favorite books.
- **Progress Tracking**: Track your reading progress and stay motivated.
- **Integration with Hardcover.app API**: Leverage the powerful features of Hardcover.app through seamless API integration.

## 🏗️ Self Hosting

### 🐳 With Docker

There is an example compse file [here](./Docker/docker-compose.yml). Be sure to generate a secret key and adjust the admin username and password. From there, launch the app and sign in as administrator. Once launched and logged in, be sure to set your Hardcover API key in the settings page! This will be used to fetch books and track progress in your clubs.

```yaml
---

services:
  hardcover_bookclub:
    container_name: hardcover_bookclub
    image: ghcr.io/tsparr/hardcover_bookclub:latest
    restart: unless-stopped
    ports:
      - 8000:8000
    environment:
      # secret key, can be generated with `openssl rand -base64 32`
      - "DJANGO_SECRET_KEY=i-need-to-be-changed-please-change-me"
      # allowed hosts, if behind a reverse proxy set your domain here
      - "DJANGO_ALLOWED_HOSTS=my.domain.com,localhost,127.0.0.1"
      # admin settings
      - DJANGO_ADMIN_USERNAME=admin
      - DJANGO_ADMIN_EMAIL=admin@email.com
      - DJANGO_ADMIN_PASSWORD=admin
      # trusted origins, set to your domain if behind a reverse proxy
      - DJANGO_CSRF_TRUSTED_ORIGINS=https://bookclub.zmthree.xyz
      # optionally enable debug mode
      - DJANGO_DEBUG=False
    volumes:
      - "./db.sqlite3:/app/db.sqlite3:rw"

```

## 🔨 Development

### 🐍 Running Locally

The bash script on the root directory [start.sh](./start.sh) will set up the database and prepare the environment to run.

### 🔃 Reset for Testing

Run the following to reset the databases for testing.

```bash
source venv/bin/activate
python manage.py flush
python manage.py createsuperuser
python manage.py set_group_admin $USERNAME
```