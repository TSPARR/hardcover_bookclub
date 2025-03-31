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
        return PlexServer(settings.PLEX_URL, settings.PLEX_TOKEN)
    except (NotFound, Unauthorized, BadRequest) as e:
        logger.error(f"Error connecting to Plex server: {str(e)}")
        return None


def update_plex_info_for_book(book):
    """
    Search Plex for a book and update the book's plex_url if found

    Args:
        book: Book model instance to update

    Returns:
        bool: True if book was updated, False otherwise
    """
    if not settings.PLEX_ENABLED:
        return False

    try:
        # Connect to Plex server
        plex = get_plex_server()
        if not plex:
            return False

        # Get the server identifier
        plex_server_identifier = plex.machineIdentifier

        # Get the audiobooks library section
        try:
            audiobooks = plex.library.section(settings.PLEX_LIBRARY_NAME)
        except NotFound:
            logger.error(f"Plex library not found: {settings.PLEX_LIBRARY_NAME}")
            return False

        # Search for the book
        try:
            book_search = audiobooks.search(
                filters={"artist.title": f"{book.author}"},
                title=f"{book.title}",
                libtype="album",
            )
        except (BadRequest, Exception) as e:
            logger.error(f"Error searching Plex for book '{book.title}': {str(e)}")

        # Check if we found any matches
        if not book_search:
            logger.info(
                f"No matches found in Plex for '{book.title}' by '{book.author}'"
            )
            return False

        # Get the best match (first result)
        best_match = book_search[0]

        # Construct the URL to the book in Plex
        book_url = f"https://app.plex.tv/desktop#!/server/{plex_server_identifier}/details?key=%2Flibrary%2Fmetadata%2F{best_match.ratingKey}"

        # Update the book model
        book.plex_url = book_url
        book.save(update_fields=["plex_url"])

        logger.info(f"Updated Plex URL for book: {book.title} by {book.author}")
        return True

    except Exception as e:
        logger.exception(
            f"Unexpected error updating Plex info for '{book.title}': {str(e)}"
        )
        return False
