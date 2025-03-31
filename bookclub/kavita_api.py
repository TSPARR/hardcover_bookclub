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
        print("Kavita integration not configured. Skipping search.")
        return None

    try:
        # Step 1: Authenticate with Kavita
        session, token = authenticate(kavita_base_url, kavita_api_key)
        if not session or not token:
            print("Failed to authenticate with Kavita API")
            return None

        # Step 2: Process the title to remove subtitles (anything after first colon)
        processed_title = book_title.split(":", 1)[0].strip()
        print(f"Original title: '{book_title}'")
        print(f"Processed title: '{processed_title}'")

        # Use only the processed title for search
        search_query = processed_title
        print(f"Search query: '{search_query}'")

        # Step 3: Search for the book
        search_url = f"{kavita_base_url}/api/Search/search"
        headers = {"Authorization": f"Bearer {token}"}
        params = {
            "queryString": search_query,
            "includeChapterAndFiles": "true",
        }

        print(f"Sending search request to: {search_url}")
        response = session.get(search_url, headers=headers, params=params)
        print(f"Search response status: {response.status_code}")

        if response.status_code != 200:
            print(f"Error response: {response.text}")
            return None

        response.raise_for_status()
        data = response.json()

        # Print the top-level keys in the response
        print(f"Response keys: {data.keys()}")

        # Let's see what's in each section of the response
        if "series" in data:
            print(f"Series count: {len(data['series'])}")
            if data["series"]:
                print(
                    f"First series match: '{data['series'][0].get('name', 'unknown')}'"
                )
        else:
            print("No series key in response")

        if "chapters" in data:
            print(f"Chapters count: {len(data['chapters'])}")
            if data["chapters"]:
                print(
                    f"First chapter match: '{data['chapters'][0].get('titleName', 'unknown')}'"
                )
                print(f"Volume ID: {data['chapters'][0].get('volumeId', 'unknown')}")
        else:
            print("No chapters key in response")

        # Step 4: First check for series matches - this is our preferred match type
        if "series" in data and data["series"]:
            series_matches = data["series"]
            print(f"Found {len(series_matches)} series matches, using first match")

            # If we found a series match, use that directly
            best_match = series_matches[0]  # Assuming first match is best

            series_id = best_match.get("id")
            library_id = best_match.get("libraryId")

            if series_id and library_id:
                # For series, we build a URL directly to the series page
                kavita_url = (
                    f"{kavita_base_url}/library/{library_id}/series/{series_id}"
                )
                print(f"Created series URL: {kavita_url}")
                return kavita_url

        # Step 5: If no series matches found, only then try chapters
        if "chapters" in data and data["chapters"]:
            chapter_matches = data["chapters"]
            print(f"No series matches, falling back to chapter match")

            # Find the most relevant chapter match
            best_match = chapter_matches[0]

            chapter_id = best_match.get("id")
            volume_id = best_match.get("volumeId")

            if not chapter_id or not volume_id:
                print("Missing chapter_id or volume_id in chapter match")
                return None

            # Get series info for this chapter
            series_url = f"{kavita_base_url}/api/search/series-for-chapter"
            params = {"chapterId": chapter_id}

            print(f"Getting series info for chapter_id: {chapter_id}")
            series_response = session.get(series_url, headers=headers, params=params)
            print(f"Series info response status: {series_response.status_code}")

            if series_response.status_code != 200:
                print(f"Error response: {series_response.text}")
                return None

            series_response.raise_for_status()
            series_data = series_response.json()

            print(f"Series data for chapter: {series_data.get('name', 'unknown')}")

            series_id = series_data.get("id")
            library_id = series_data.get("libraryId")

            if not series_id or not library_id:
                print("Missing series_id or library_id in series-for-chapter response")
                return None

            # Build the final URL for chapter-based matches
            kavita_url = f"{kavita_base_url}/library/{library_id}/series/{series_id}/volume/{volume_id}"
            print(f"Created chapter-based URL: {kavita_url}")
            return kavita_url

        print("No matches found")
        return None

    except Exception as e:
        print(f"Error searching Kavita API: {str(e)}")
        import traceback

        print(traceback.format_exc())
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
