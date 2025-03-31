# 📚 Hardcover Bookclub

## 📝 Description

Hardcover Bookclub is a self-hosted application that integrates seamlessly with the Hardcover.app API. It allows users to create and manage book entries, leave comments, engage in discussions, and track their reading progress—all within the application. This project aims to provide a comprehensive platform for book enthusiasts to connect and share their reading experiences.

### 🔑 Key Features:
- **Book Management**: Create and manage book entries with ease.
- **Comments and Discussions**: Leave comments and engage in discussions about your favorite books.
- **Progress Tracking**: Track your reading progress and stay motivated.
- **Integration with Hardcover.app API**: Leverage the powerful features of Hardcover.app through seamless API integration.
- **Optional Kavita Integration**: Connect with your self-hosted Kavita library for easy access to your digital books.

## 🏗️ Self Hosting

### 🐳 With Docker

There is an example compose file [here](./Docker/docker-compose.yml). Be sure to generate a secret key and adjust the admin username and password. From there, launch the app and sign in as administrator. Once launched and logged in, be sure to set your Hardcover API key in the settings page! This will be used to fetch books and track progress in your clubs.

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
      # optional Kavita integration
      - KAVITA_BASE_URL=https://your-kavita-server.com
      - KAVITA_API_KEY=your-kavita-api-key
    volumes:
      - "./db.sqlite3:/app/db.sqlite3:rw"
```

### 📚 Kavita Integration (Optional)

The app includes optional integration with [Kavita](https://www.kavitareader.com/), a self-hosted digital library server. This integration adds "View on Kavita" links to books that exist in your Kavita library.

#### Setup

1. **Environment Variables**: Add the following environment variables to enable Kavita integration:

   ```
    KAVITA_BASE_URL=https://your-kavita-server.com
    KAVITA_API_KEY=your-kavita-api-key
   ```

2. **API Key**: You can find or create your Kavita API key in the Kavita admin dashboard under Settings > API Key.

3. **How It Works**: When a book detail page is viewed, the app will automatically search your Kavita library for matching books and add a "View on Kavita" link if found.

4. **No Configuration Needed**: There's no additional setup required beyond setting the environment variables - the integration is designed to work seamlessly in the background.

#### Troubleshooting

- If links aren't appearing, check that your API key has appropriate permissions
- The search uses the book title and author to find matches, so ensure your Kavita library has accurate metadata
- For best results, maintain consistent naming conventions between your Hardcover and Kavita libraries

## 🔨 Development

### 🐍 Running Locally

The bash script on the root directory [start.sh](./start.sh) will set up the database and prepare the environment to run.

### 🔃 Reset for Testing

Run the following to reset the databases for testing.

```
source venv/bin/activate
python manage.py flush
python manage.py createsuperuser
python manage.py set_group_admin $USERNAME
```