"""
Book-specific utility functions for views.
"""

import logging
from datetime import datetime

from django.urls import reverse
from django.utils import timezone

from ..models import BookEdition

logger = logging.getLogger(__name__)


def _get_progress_value_for_sorting(comment):
    """
    Helper function to convert different progress types to comparable values
    Returns a value between 0 and 100 representing the reading progress
    """
    # Prioritize hardcover_percent if available
    if comment.hardcover_percent is not None:
        return float(comment.hardcover_percent)

    # Next, try hardcover_current_page if available
    if comment.hardcover_current_page:
        # First check if we have an associated edition with pages
        if hasattr(comment, "hardcover_edition_id") and comment.hardcover_edition_id:
            # Try to find the edition
            from ..models import BookEdition

            edition = BookEdition.objects.filter(
                hardcover_edition_id=comment.hardcover_edition_id
            ).first()

            if edition and edition.pages:
                return (comment.hardcover_current_page / edition.pages) * 100

        # Fall back to book pages
        if comment.book.pages:
            return (comment.hardcover_current_page / comment.book.pages) * 100

    # Handle percentage progress type
    if comment.progress_type == "percent":
        try:
            # Extract numeric part from percentage string (e.g., "75%" -> 75)
            return float(str(comment.progress_value).replace("%", ""))
        except (ValueError, AttributeError, TypeError):
            return 0.0

    # Handle page progress type
    elif comment.progress_type == "page":
        try:
            page = int(comment.progress_value)

            # First check if we have an associated edition with pages
            if (
                hasattr(comment, "hardcover_edition_id")
                and comment.hardcover_edition_id
            ):
                # Try to find the edition
                from ..models import BookEdition

                edition = BookEdition.objects.filter(
                    hardcover_edition_id=comment.hardcover_edition_id
                ).first()

                if edition and edition.pages:
                    return (page / edition.pages) * 100

            # Fall back to book pages
            if comment.book.pages:
                return (page / comment.book.pages) * 100

            # If no book pages, just return the raw page number
            return float(page)
        except (ValueError, AttributeError, TypeError):
            return 0.0

    # Handle audio progress type
    elif comment.progress_type == "audio":
        # Use hardcover_current_position if available
        if comment.hardcover_current_position:
            # First check if we have an associated edition with audio seconds
            if (
                hasattr(comment, "hardcover_edition_id")
                and comment.hardcover_edition_id
            ):
                # Try to find the edition
                from ..models import BookEdition

                edition = BookEdition.objects.filter(
                    hardcover_edition_id=comment.hardcover_edition_id
                ).first()

                if edition and edition.audio_seconds:
                    return (
                        comment.hardcover_current_position / edition.audio_seconds
                    ) * 100

            # Fall back to book audio seconds
            if comment.book.audio_seconds:
                return (
                    comment.hardcover_current_position / comment.book.audio_seconds
                ) * 100

        # Try parsing audio progress
        from .book_utils import parse_audio_progress

        try:
            total_seconds = parse_audio_progress(comment.progress_value)
            if total_seconds:
                # First check if we have an edition with audio seconds
                if (
                    hasattr(comment, "hardcover_edition_id")
                    and comment.hardcover_edition_id
                ):
                    # Try to find the edition
                    from ..models import BookEdition

                    edition = BookEdition.objects.filter(
                        hardcover_edition_id=comment.hardcover_edition_id
                    ).first()

                    if edition and edition.audio_seconds:
                        return (total_seconds / edition.audio_seconds) * 100

                # Fall back to book audio seconds
                if comment.book.audio_seconds:
                    return (total_seconds / comment.book.audio_seconds) * 100
        except (ValueError, AttributeError, TypeError):
            pass

    # Default fallback
    return 0.0


def calculate_normalized_progress(obj):
    """
    Calculate and set the normalized progress (0-100) for a UserBookProgress or Comment object
    """
    normalized_progress = _get_progress_value_for_sorting(obj)
    obj.normalized_progress = normalized_progress
    return obj


def extract_publisher_name(publisher_data):
    """Extract publisher name from different data formats"""
    if not publisher_data:
        return ""

    # If it's already a string, return it
    if isinstance(publisher_data, str):
        # If it looks like a dictionary string, try to parse it
        if publisher_data.startswith("{") and "name" in publisher_data:
            try:
                import ast

                publisher_dict = ast.literal_eval(publisher_data)
                if isinstance(publisher_dict, dict) and "name" in publisher_dict:
                    return publisher_dict["name"]
            except:
                pass
        return publisher_data

    # If it's a dict with 'name' key
    if isinstance(publisher_data, dict) and "name" in publisher_data:
        return publisher_data["name"]

    # Return as string as fallback
    return str(publisher_data)


def create_or_update_book_edition(book, edition_data):
    """Create or update a BookEdition from Hardcover API data"""
    # Handle different formats of cover image URL
    cover_image_url = ""
    if "cover_image_url" in edition_data and edition_data["cover_image_url"]:
        cover_image_url = edition_data["cover_image_url"]
    elif "cached_image" in edition_data and edition_data["cached_image"]:
        cover_image_url = edition_data["cached_image"].get("url", "")

    # Handle different formats of publisher data
    publisher = ""
    if "publisher" in edition_data:
        publisher = extract_publisher_name(edition_data["publisher"])

    edition, created = BookEdition.objects.update_or_create(
        hardcover_edition_id=str(edition_data["id"]),
        defaults={
            "book": book,
            "title": edition_data.get("title", book.title),
            "isbn": edition_data.get("isbn_10", ""),
            "isbn13": edition_data.get("isbn_13", ""),
            "cover_image_url": cover_image_url,
            "publisher": publisher,
            "pages": edition_data.get("pages"),
            "audio_seconds": edition_data.get("audio_seconds"),
            "reading_format": edition_data.get("reading_format", ""),
            "reading_format_id": edition_data.get("reading_format_id"),
        },
    )

    # Set publication date if available
    if edition_data.get("release_date"):
        try:
            edition.publication_date = datetime.strptime(
                edition_data["release_date"], "%Y-%m-%d"
            ).date()
            edition.save(update_fields=["publication_date"])
        except (ValueError, TypeError):
            pass

    return edition


def convert_progress_to_pages(progress_percent, edition=None, book=None):
    """Convert percentage to pages based on edition or book data"""
    if edition and edition.pages:
        return int((progress_percent / 100) * edition.pages)
    elif book and book.pages:
        return int((progress_percent / 100) * book.pages)
    return None


def convert_progress_to_seconds(progress_percent, edition=None, book=None):
    """Convert percentage to audio seconds based on edition or book data"""
    if edition and edition.audio_seconds:
        return int((progress_percent / 100) * edition.audio_seconds)
    elif book and book.audio_seconds:
        return int((progress_percent / 100) * book.audio_seconds)
    return None


def parse_audio_progress(progress_value):
    """Parse audio progress values like '2h 30m' into seconds"""
    try:
        seconds = 0
        if "h" in progress_value:
            parts = progress_value.split()
            hours_part = next((p for p in parts if "h" in p), None)
            if hours_part:
                seconds += int(hours_part.replace("h", "")) * 3600

            minutes_part = next((p for p in parts if "m" in p), None)
            if minutes_part:
                seconds += int(minutes_part.replace("m", "")) * 60
        elif "m" in progress_value:
            seconds = int(progress_value.replace("m", "")) * 60
        return seconds
    except (ValueError, TypeError):
        return None


def sync_progress_to_hardcover(user, book, user_progress, pages=None, seconds=None):
    """Sync reading progress to Hardcover API"""
    from ..hardcover_api import HardcoverAPI  # Import here to avoid circular imports

    if not user.profile.hardcover_api_key:
        return {"error": "No Hardcover API key configured"}

    hardcover_read_id = user_progress.hardcover_read_id

    # Determine edition ID if available
    edition_id = None
    if user_progress.edition and user_progress.edition.hardcover_edition_id:
        edition_id = int(user_progress.edition.hardcover_edition_id)

    # If we have an existing read ID, update it
    if hardcover_read_id:
        try:
            return HardcoverAPI.update_reading_progress(
                read_id=hardcover_read_id,
                started_at=user_progress.hardcover_started_at,
                finished_at=user_progress.hardcover_finished_at,
                edition_id=edition_id,
                pages=pages,
                seconds=seconds,
                user=user,
            )
        except Exception as e:
            logger.exception(f"Error syncing to Hardcover: {str(e)}")
            return {"error": str(e)}
    else:
        # No existing record, create a new one
        try:
            result = HardcoverAPI.start_reading_progress(
                book_id=book.hardcover_id,
                edition_id=edition_id,
                pages=pages,
                seconds=seconds,
                started_at=user_progress.hardcover_started_at or timezone.now(),
                user=user,
            )

            # Save the read ID for future updates if successful
            if result and "success" in result and "read_id" in result:
                user_progress.hardcover_read_id = str(result["read_id"])
                user_progress.save(update_fields=["hardcover_read_id"])

            return result
        except Exception as e:
            logger.exception(f"Error starting Hardcover tracking: {str(e)}")
            return {"error": str(e)}


def process_progress_from_request(request_data, user_progress):
    """Process and update user progress based on request data"""
    # Check if we're clearing Hardcover data
    clear_hardcover_data = request_data.get("clear_hardcover_data", False)

    # Update basic progress fields
    if "progress_type" in request_data and "progress_value" in request_data:
        user_progress.progress_type = request_data["progress_type"]
        user_progress.progress_value = request_data["progress_value"]

    # Process Hardcover data if available and not clearing
    if "hardcover_data" in request_data and not clear_hardcover_data:
        hardcover_data = request_data["hardcover_data"]

        # Process timestamps
        started_at = hardcover_data.get("started_at")
        finished_at = hardcover_data.get("finished_at")

        if started_at:
            user_progress.hardcover_started_at = timezone.make_aware(
                timezone.datetime.strptime(started_at, "%Y-%m-%d")
            )
        else:
            user_progress.hardcover_started_at = None

        if finished_at:
            user_progress.hardcover_finished_at = timezone.make_aware(
                timezone.datetime.strptime(finished_at, "%Y-%m-%d")
            )
        else:
            user_progress.hardcover_finished_at = None

        # Update other fields
        user_progress.hardcover_percent = hardcover_data.get("progress")
        user_progress.hardcover_current_page = hardcover_data.get("current_page")
        user_progress.hardcover_current_position = hardcover_data.get(
            "current_position"
        )
        user_progress.hardcover_reading_format = hardcover_data.get("reading_format")
        user_progress.hardcover_edition_id = hardcover_data.get("edition_id")

        if "user_book_id" in hardcover_data:
            user_progress.hardcover_read_id = str(hardcover_data["user_book_id"])

        if "rating" in hardcover_data:
            user_progress.hardcover_rating = hardcover_data.get("rating")
    elif clear_hardcover_data:
        # Clear Hardcover percentage and position data
        user_progress.hardcover_percent = None
        user_progress.hardcover_current_page = None
        user_progress.hardcover_current_position = None
        # Keep other fields like hardcover_read_id for reference

    # Calculate and set normalized progress
    user_progress.normalized_progress = _get_progress_value_for_sorting(user_progress)

    return user_progress


def link_progress_to_edition(user_progress, hardcover_edition_id, book, user):
    """
    Try to link user progress to a book edition
    Returns: Boolean indicating whether page reload is needed
    """
    from ..hardcover_api import HardcoverAPI  # Import here to avoid circular imports

    try:
        # Check if we already have this edition
        edition = BookEdition.objects.get(
            hardcover_edition_id=str(hardcover_edition_id)
        )
        user_progress.edition = edition
        logger.debug(f"Linked progress to existing edition ID: {hardcover_edition_id}")
        return False  # No need to reload page
    except BookEdition.DoesNotExist:
        # Try to fetch and create the edition
        try:
            editions = HardcoverAPI.get_book_editions(book.hardcover_id, user=user)
            if editions:
                for edition_data in editions:
                    if str(edition_data["id"]) == str(hardcover_edition_id):
                        # Create the edition using the helper function
                        edition = create_or_update_book_edition(book, edition_data)
                        user_progress.edition = edition
                        logger.debug(
                            f"Created and linked to new edition ID: {hardcover_edition_id}"
                        )
                        return True  # Reload page with new edition
        except Exception as e:
            logger.exception(f"Error fetching edition data: {str(e)}")

    return False


def process_hardcover_edition_data(book, comment, hardcover_data, user_progress, user):
    """Process Hardcover edition data from a comment form submission"""
    from ..hardcover_api import HardcoverAPI  # Import here to avoid circular imports

    try:
        # Save Hardcover data to the comment with timezone-aware dates
        started_at = hardcover_data.get("started_at")
        finished_at = hardcover_data.get("finished_at")

        # Make them timezone aware if they exist
        if started_at:
            comment.hardcover_started_at = timezone.make_aware(
                timezone.datetime.strptime(started_at, "%Y-%m-%d")
            )
        else:
            comment.hardcover_started_at = None

        if finished_at:
            comment.hardcover_finished_at = timezone.make_aware(
                timezone.datetime.strptime(finished_at, "%Y-%m-%d")
            )
        else:
            comment.hardcover_finished_at = None

        comment.hardcover_percent = hardcover_data.get("progress")
        comment.hardcover_current_page = hardcover_data.get("current_page")
        comment.hardcover_current_position = hardcover_data.get("current_position")
        comment.hardcover_reading_format = hardcover_data.get("reading_format")
        comment.hardcover_edition_id = hardcover_data.get("edition_id")

        # Calculate and set normalized progress for the comment
        comment.normalized_progress = _get_progress_value_for_sorting(comment)

        if hardcover_data.get("rating") is not None:
            comment.hardcover_rating = hardcover_data.get("rating")
            user_progress.hardcover_rating = hardcover_data.get("rating")

        # Update book metadata if available and not already saved
        if hardcover_data.get("edition_pages") and not book.pages:
            book.pages = hardcover_data.get("edition_pages")
            book.save(update_fields=["pages"])

        if hardcover_data.get("edition_audio_seconds") and not book.audio_seconds:
            book.audio_seconds = hardcover_data.get("edition_audio_seconds")
            book.save(update_fields=["audio_seconds"])

        # Update the user's book progress with the same data
        user_progress.progress_type = comment.progress_type
        user_progress.progress_value = comment.progress_value
        user_progress.hardcover_started_at = comment.hardcover_started_at
        user_progress.hardcover_finished_at = comment.hardcover_finished_at
        user_progress.hardcover_percent = comment.hardcover_percent
        user_progress.hardcover_current_page = comment.hardcover_current_page
        user_progress.hardcover_current_position = comment.hardcover_current_position
        user_progress.hardcover_reading_format = comment.hardcover_reading_format
        user_progress.hardcover_edition_id = comment.hardcover_edition_id

        # Update normalized progress for user progress
        user_progress.normalized_progress = _get_progress_value_for_sorting(
            user_progress
        )

        # If there's an edition_id, try to link to the corresponding BookEdition
        if comment.hardcover_edition_id:
            link_progress_to_edition(
                user_progress, comment.hardcover_edition_id, book, user
            )

        user_progress.save()
        return True

    except Exception as e:
        logger.exception(f"Error processing Hardcover edition data: {str(e)}")
        return False


def get_redirect_url_with_params(request, view_name, kwargs=None, anchor=None):
    """
    Build a redirect URL for the discussion tab that preserves relevant query parameters.

    Args:
        request: The current request
        view_name: Name of the view to redirect to
        kwargs: Additional kwargs for the reverse function
        anchor: Optional anchor fragment for the URL

    Returns:
        String with the full redirect URL
    """
    # Get the base URL
    redirect_url = reverse(view_name, kwargs=kwargs)

    # Always use discussion tab
    params = ["tab=discussion"]

    # Add sort parameter if it exists in the request
    sort = request.GET.get("sort")
    if sort:
        params.append(f"sort={sort}")

    # Add parameters to URL
    redirect_url += "?" + "&".join(params)

    # Add fragment identifier if provided
    if anchor:
        redirect_url += f"#{anchor}"

    return redirect_url
