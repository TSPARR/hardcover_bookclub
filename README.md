# 📚 Hardcover Bookclub

## 📝 Description

Hardcover Bookclub is a self-hosted application that integrates seamlessly with the Hardcover.app API. It allows users to create and manage book entries, leave comments, engage in discussions, and track their reading progress—all within the application. This project aims to provide a comprehensive platform for book enthusiasts to connect and share their reading experiences.

### 🔑 Key Features:
- **Book Management**: Create and manage book entries with ease.
- **Comments and Discussions**: Leave comments and engage in discussions about your favorite books.
- **Progress Tracking**: Track your reading progress and stay motivated.
- **Integration with Hardcover.app API**: Leverage the powerful features of Hardcover.app through seamless API integration.
- **Optional Plex Integration**: Link directly to audiobooks in your Plex library.
- **Optional Kavita Integration**: Connect with your self-hosted Kavita library for easy access to your digital books.
- **Optional Admin Promoted Editions**: Quickly promote the editions your users will be most likely to use.
- **Optional Dollar Bets Feature**: Let members place friendly $1 wagers on predictions about books they're reading.

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
      - DJANGO_CSRF_TRUSTED_ORIGINS=https://bookclub.domain.com
      # optionally enable debug mode
      - DJANGO_DEBUG=False
      # optional Plex integration
      - PLEX_URL=https://your-plex-server.com
      - PLEX_TOKEN=your-plex-token
      - PLEX_LIBRARY_NAME=Audiobooks
      # optional Kavita integration
      - KAVITA_BASE_URL=https://your-kavita-server.com
      - KAVITA_API_KEY=your-kavita-api-key
      # optional Dollar Bets feature
      - ENABLE_DOLLAR_BETS=False
    volumes:
      - "./db.sqlite3:/app/db.sqlite3:rw"
```

### 🎧 Plex Integration (Optional)

<details>
<summary>Click to expand Plex integration details</summary>

The app includes optional integration with [Plex](https://www.plex.tv/), allowing you to link directly to audiobooks in your Plex library. This integration adds "View on Plex" links to books that exist in your Plex library.

#### Setup

1. **Environment Variables**: Add the following environment variables to enable Plex integration:
  
  ```
    PLEX_URL=https://your-plex-server.com
    PLEX_TOKEN=your-plex-token
    PLEX_LIBRARY_NAME=Audiobooks
  ```

2. **Plex Token**: To find your Plex token, please refer to the [official documentation](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/).

3. **Library Name**: Use the exact name of your audiobooks library in Plex (case-sensitive).

4. **How It Works**: When a book detail page is viewed, the app will automatically search your Plex library for matching books by title and author, and add a "View on Plex" link if found.

5. **No Configuration Needed**: There's no additional setup required beyond setting the environment variables - the integration is designed to work seamlessly in the background.

#### Troubleshooting

- The search uses the author and book title to find matches, so ensure your Plex library has accurate metadata
- The search removes subtitles (text after colons) from book titles for better matching
- For best results, maintain consistent naming conventions between your Hardcover and Plex libraries
</details>

### 📚 Kavita Integration (Optional)

<details>
<summary>Click to expand Kavita integration details</summary>

The app includes optional integration with [Kavita](https://www.kavitareader.com/), a self-hosted digital library server. This integration adds "View on Kavita" links to books that exist in your Kavita library.

#### Setup

1. **Environment Variables**: Add the following environment variables to enable Kavita integration:

  ```
    KAVITA_BASE_URL=https://your-kavita-server.com
    KAVITA_API_KEY=your-kavita-api-key
  ```

2. **API Key**: You can find or create your Kavita API key in the Kavita interface under Settings > Account -> API Key / OPDS.

3. **How It Works**: When a book detail page is viewed, the app will automatically search your Kavita library for matching books and add a "View on Kavita" link if found.

4. **No Configuration Needed**: There's no additional setup required beyond setting the environment variables - the integration is designed to work seamlessly in the background.

#### Troubleshooting

- The search uses the book title to find matches, so ensure your Kavita library has accurate metadata
- The search removes subtitles (text after colons) from book titles for better matching
- For best results, maintain consistent naming conventions between your Hardcover and Kavita libraries
</details>

### 💵 Dollar Bets (Optional)

<details>
<summary>Click to expand Dollar Bets functionality details</summary>

### Setup

**Environment Variable**: Add the following environment variable to enable the dollar bets feature:

```
DOLLAR_BETS_ENABLED=True
```

**Per-Group Activation**: Even with the feature enabled at the instance level, group admins must explicitly enable dollar bets for their specific book clubs in group settings.

**Key Features**:

- Reader Predictions: Members can create specific bets about plot developments, character fates, and other story elements.
- Spoiler Protection: Three-tier spoiler system (No Spoilers, Halfway Through, Finished Book) prevents unwanted plot revelations.
- Simple Management: Users can accept open bets or cancel their own proposals.
- Admin Tools: Group admins can create bets between specific members and resolve outcomes.

**How It Works**:
- Members propose predictions with a $1 stake
- Other members can accept bets they disagree with
- Admins resolve bets by declaring winners when outcomes are known
- All bets are organized by status (Open, Active, Resolved, Inconclusive) for easy tracking
</details>

### 🔨 Development

<details>
<summary>Click to see information about setting up a dev environment</summary>

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
</details>