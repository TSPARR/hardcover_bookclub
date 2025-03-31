import requests
from django.conf import settings


def authenticate(api_url_base, api_key):
    """Get authentication token from Kavita API"""
    session = requests.Session()
    auth_url = f"{api_url_base}/api/Plugin/authenticate/?apiKey={api_key}&pluginName=BookclubApp"

    response = session.post(auth_url)

    response.raise_for_status()
    token_response = response.json()
    token = token_response.get("token")

    return session, token


def get_kavita_book_url(book_title):
    """
    Search for a book in Kavita and return its URL if found
    """
    kavita_base_url = settings.KAVITA_BASE_URL
    kavita_api_key = settings.KAVITA_API_KEY

    # Skip if Kavita integration is not configured
    if not kavita_base_url or not kavita_api_key:
        return None

    try:
        # Step 1: Authenticate with Kavita
        session, token = authenticate(kavita_base_url, kavita_api_key)
        if not session or not token:
            return None

        # Step 2: Search for the book
        search_url = f"{kavita_base_url}/api/Search/search"
        headers = {"Authorization": f"Bearer {token}"}
        params = {
            "queryString": f"{book_title}",
            "includeChapterAndFiles": "true",
        }

        response = session.get(search_url, headers=headers, params=params)

        response.raise_for_status()

        data = response.json()

        # Step 3: First check for series matches
        series_matches = []
        if "series" in data and data["series"]:
            series_matches = data["series"]

        if series_matches:
            # If we found a series match, use that directly
            best_match = series_matches[0]  # Assuming first match is best

            series_id = best_match.get("id")
            library_id = best_match.get("libraryId")

            if series_id and library_id:
                # For series, we build a URL to the series page
                kavita_url = (
                    f"{kavita_base_url}/library/{library_id}/series/{series_id}"
                )
                return kavita_url

        # Step 4: If no series matches, try chapters
        chapter_matches = []
        if "chapters" in data and data["chapters"]:
            chapter_matches = data["chapters"]

        if not chapter_matches:
            return None

        # Find the most relevant chapter match
        best_match = chapter_matches[0]

        chapter_id = best_match.get("id")
        volume_id = best_match.get("volumeId")

        if not chapter_id or not volume_id:
            return None

        # Get series info for this chapter
        series_url = f"{kavita_base_url}/api/search/series-for-chapter"
        params = {"chapterId": chapter_id}

        series_response = session.get(series_url, headers=headers, params=params)

        if series_response.status_code != 200:
            return None

        series_response.raise_for_status()

        series_data = series_response.json()

        series_id = series_data.get("id")
        library_id = series_data.get("libraryId")

        if not series_id or not library_id:
            return None

        # Build the final URL for chapter-based matches
        kavita_url = f"{kavita_base_url}/library/{library_id}/series/{series_id}/volume/{volume_id}"

        return kavita_url

    except Exception as e:
        return None


def update_kavita_info_for_book(book):
    """
    Update Kavita information for a book
    """

    kavita_url = get_kavita_book_url(book.title)

    if kavita_url:
        book.kavita_url = kavita_url
        book.save(update_fields=["kavita_url"])
        return True

    return False
