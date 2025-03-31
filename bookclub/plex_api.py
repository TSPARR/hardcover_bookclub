import logging

from django.conf import settings
from plexapi.exceptions import BadRequest, NotFound, Unauthorized
from plexapi.server import PlexServer

logger = logging.getLogger(__name__)


def get_plex_server():
    """
    Get a connection to the Plex server

    Returns:
        PlexServer object or None if connection fails
    """
    if not settings.PLEX_ENABLED:
        logger.warning("Plex integration is not enabled")
        return None

    try:
        return PlexServer(settings.PLEX_BASE_URL, settings.PLEX_TOKEN)
    except (NotFound, Unauthorized, BadRequest) as e:
        logger.error(f"Error connecting to Plex server: {str(e)}")
        return None


def get_plex_book_url(book_title, book_author):
    """
    Search for a book in Plex and return its URL if found

    Args:
        book_title (str): Title of the book
        book_author (str): Author of the book

    Returns:
        str: URL to the book in Plex or None if not found
    """
    # Skip if Plex integration is not configured
    if not settings.PLEX_ENABLED:
        return None

    try:
        # Connect to Plex server
        plex = get_plex_server()
        if not plex:
            return None

        # Get the server identifier
        plex_server_identifier = plex.machineIdentifier

        # Get the audiobooks library section
        try:
            audiobooks = plex.library.section(settings.PLEX_LIBRARY_NAME)
        except NotFound:
            logger.error(f"Plex library not found: {settings.PLEX_LIBRARY_NAME}")
            return None

        # Process the title to remove subtitles (anything after first colon)
        processed_title = book_title.split(":", 1)[0].strip()

        # Search for the book using the processed title and author filter
        try:
            book_search = audiobooks.search(
                filters={"artist.title": f"{book_author}"},
                title=f"{processed_title}",
                libtype="album",
            )
        except Exception as e:
            logger.error(
                f"Error searching Plex for '{processed_title}' by '{book_author}': {str(e)}"
            )
            return None

        # Check if we found any matches
        if not book_search:
            logger.info(
                f"No matches found in Plex for '{processed_title}' by '{book_author}'"
            )
            return None

        # Get the best match (first result)
        best_match = book_search[0]

        # Construct the URL to the book in Plex
        book_url = f"https://app.plex.tv/desktop#!/server/{plex_server_identifier}/details?key=%2Flibrary%2Fmetadata%2F{best_match.ratingKey}"

        return book_url

    except Exception as e:
        logger.exception(
            f"Unexpected error searching Plex for '{book_title}': {str(e)}"
        )
        return None


def update_plex_info_for_book(book):
    """
    Update Plex information for a book
    """
    plex_url = get_plex_book_url(book.title, book.author)

    if plex_url:
        book.plex_url = plex_url
        book.save(update_fields=["plex_url"])
        return True

    return False
