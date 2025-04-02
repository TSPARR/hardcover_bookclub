"""
Validator utilities for reading progress values.
"""

import re
from datetime import timedelta


class ProgressValidator:
    """Utility class for validating reading progress inputs."""

    @staticmethod
    def validate_percentage(value):
        """
        Validate a percentage value (0-100, whole number).

        Args:
            value: The percentage value as string

        Returns:
            tuple: (is_valid, value_or_error_message)
        """
        try:
            # Remove % sign if present
            if isinstance(value, str):
                value = value.replace("%", "").strip()

            percent = int(float(value))
            if percent < 0 or percent > 100:
                return False, "Percentage must be between 0 and 100"

            return True, percent
        except (ValueError, TypeError):
            return False, "Percentage must be a whole number"

    @staticmethod
    def validate_page_number(value, max_pages=None):
        """
        Validate a page number (whole number, not more than max pages).

        Args:
            value: The page number as string
            max_pages: Maximum number of pages (optional)

        Returns:
            tuple: (is_valid, value_or_error_message)
        """
        try:
            if isinstance(value, str):
                value = value.strip()

            page = int(float(value))
            if page < 1:
                return False, "Page number must be at least 1"

            if max_pages and page > max_pages:
                return False, f"Page number cannot exceed {max_pages}"

            return True, page
        except (ValueError, TypeError):
            return False, "Page number must be a whole number"

    @staticmethod
    def validate_audio_timestamp(value, max_seconds=None):
        """
        Validate audio timestamp (HH:MM:SS format or HhMm format).

        Args:
            value: The timestamp as string
            max_seconds: Maximum audio duration in seconds (optional)

        Returns:
            tuple: (is_valid, value_or_error_message, seconds)
        """
        # Check for HH:MM:SS format
        colon_pattern = r"^(\d+):([0-5]?\d):([0-5]?\d)$"
        colon_match = re.match(colon_pattern, value)

        if colon_match:
            hours = int(colon_match.group(1))
            minutes = int(colon_match.group(2))
            seconds = int(colon_match.group(3))

            total_seconds = (hours * 3600) + (minutes * 60) + seconds

            if max_seconds and total_seconds > max_seconds:
                max_time = str(timedelta(seconds=max_seconds))
                return False, f"Timestamp cannot exceed {max_time}", None

            return True, value, total_seconds

        # Check for Xh Ym format
        time_pattern = r"^(?:(\d+)h\s*)?(?:(\d+)m)?$"
        time_match = re.match(time_pattern, value)

        if time_match and (time_match.group(1) or time_match.group(2)):
            hours = int(time_match.group(1) or 0)
            minutes = int(time_match.group(2) or 0)

            if minutes >= 60:
                return False, "Minutes must be less than 60", None

            total_seconds = (hours * 3600) + (minutes * 60)

            if max_seconds and total_seconds > max_seconds:
                max_hours = max_seconds // 3600
                max_minutes = (max_seconds % 3600) // 60

                max_time = f"{max_hours}h {max_minutes}m"
                return False, f"Timestamp cannot exceed {max_time}", None

            return True, f"{hours}h {minutes}m", total_seconds

        return False, 'Audio timestamp must be in format "HH:MM:SS" or "Xh Ym"', None

    @classmethod
    def validate(cls, progress_type, value, book_data=None):
        """
        Validate progress based on type and value.

        Args:
            progress_type: Type of progress ('percent', 'page', 'audio')
            value: Progress value to validate
            book_data: Book/edition data for range validation

        Returns:
            tuple: (is_valid, value_or_error_message, [seconds_for_audio])
        """
        if not value:
            return False, "Progress value is required", None

        if progress_type == "percent":
            valid, result = cls.validate_percentage(value)
            return valid, result, None

        elif progress_type == "page":
            max_pages = cls._get_max_pages(book_data)
            valid, result = cls.validate_page_number(value, max_pages)
            return valid, result, None

        elif progress_type == "audio":
            max_seconds = cls._get_max_audio_seconds(book_data)
            return cls.validate_audio_timestamp(value, max_seconds)

        return False, f"Unknown progress type: {progress_type}", None

    @staticmethod
    def _get_max_pages(book_data):
        """Extract max pages from book data."""
        if not book_data:
            return None

        # First check user's selected edition
        if isinstance(book_data, dict):
            # Handle dictionary input
            if "edition" in book_data and book_data["edition"]:
                if (
                    isinstance(book_data["edition"], dict)
                    and "pages" in book_data["edition"]
                ):
                    return book_data["edition"]["pages"]
                elif (
                    hasattr(book_data["edition"], "pages")
                    and book_data["edition"].pages
                ):
                    return book_data["edition"].pages

            # Check for promoted Kavita edition if available
            if (
                "kavita_promoted_edition" in book_data
                and book_data["kavita_promoted_edition"]
            ):
                if (
                    isinstance(book_data["kavita_promoted_edition"], dict)
                    and "pages" in book_data["kavita_promoted_edition"]
                ):
                    return book_data["kavita_promoted_edition"]["pages"]
                elif (
                    hasattr(book_data["kavita_promoted_edition"], "pages")
                    and book_data["kavita_promoted_edition"].pages
                ):
                    return book_data["kavita_promoted_edition"].pages

            # Fall back to general book info
            if "book" in book_data and book_data["book"]:
                if isinstance(book_data["book"], dict) and "pages" in book_data["book"]:
                    return book_data["book"]["pages"]
                elif hasattr(book_data["book"], "pages") and book_data["book"].pages:
                    return book_data["book"].pages

            if "pages" in book_data:
                return book_data["pages"]

        # Handle model objects directly
        if (
            hasattr(book_data, "edition")
            and book_data.edition
            and hasattr(book_data.edition, "pages")
            and book_data.edition.pages
        ):
            return book_data.edition.pages

        # Check for promoted Kavita edition
        if (
            hasattr(book_data, "kavita_promoted_edition")
            and book_data.kavita_promoted_edition
            and hasattr(book_data.kavita_promoted_edition, "pages")
            and book_data.kavita_promoted_edition.pages
        ):
            return book_data.kavita_promoted_edition.pages

        # Fall back to book
        if (
            hasattr(book_data, "book")
            and book_data.book
            and hasattr(book_data.book, "pages")
            and book_data.book.pages
        ):
            return book_data.book.pages
        elif hasattr(book_data, "pages") and book_data.pages:
            return book_data.pages

        return None

    @staticmethod
    def _get_max_audio_seconds(book_data):
        """Extract max audio seconds from book data."""
        if not book_data:
            return None

        # First check user's selected edition
        if isinstance(book_data, dict):
            # Handle dictionary input
            if "edition" in book_data and book_data["edition"]:
                if (
                    isinstance(book_data["edition"], dict)
                    and "audio_seconds" in book_data["edition"]
                ):
                    return book_data["edition"]["audio_seconds"]
                elif (
                    hasattr(book_data["edition"], "audio_seconds")
                    and book_data["edition"].audio_seconds
                ):
                    return book_data["edition"].audio_seconds

            # Check for promoted Plex edition if available
            if (
                "plex_promoted_edition" in book_data
                and book_data["plex_promoted_edition"]
            ):
                if (
                    isinstance(book_data["plex_promoted_edition"], dict)
                    and "audio_seconds" in book_data["plex_promoted_edition"]
                ):
                    return book_data["plex_promoted_edition"]["audio_seconds"]
                elif (
                    hasattr(book_data["plex_promoted_edition"], "audio_seconds")
                    and book_data["plex_promoted_edition"].audio_seconds
                ):
                    return book_data["plex_promoted_edition"].audio_seconds

            # Fall back to general book info
            if "book" in book_data and book_data["book"]:
                if (
                    isinstance(book_data["book"], dict)
                    and "audio_seconds" in book_data["book"]
                ):
                    return book_data["book"]["audio_seconds"]
                elif (
                    hasattr(book_data["book"], "audio_seconds")
                    and book_data["book"].audio_seconds
                ):
                    return book_data["book"].audio_seconds

            if "audio_seconds" in book_data:
                return book_data["audio_seconds"]

        # Handle model objects directly
        if (
            hasattr(book_data, "edition")
            and book_data.edition
            and hasattr(book_data.edition, "audio_seconds")
            and book_data.edition.audio_seconds
        ):
            return book_data.edition.audio_seconds

        # Check for promoted Plex edition
        if (
            hasattr(book_data, "plex_promoted_edition")
            and book_data.plex_promoted_edition
            and hasattr(book_data.plex_promoted_edition, "audio_seconds")
            and book_data.plex_promoted_edition.audio_seconds
        ):
            return book_data.plex_promoted_edition.audio_seconds

        # Fall back to book
        if (
            hasattr(book_data, "book")
            and book_data.book
            and hasattr(book_data.book, "audio_seconds")
            and book_data.book.audio_seconds
        ):
            return book_data.book.audio_seconds
        elif hasattr(book_data, "audio_seconds") and book_data.audio_seconds:
            return book_data.audio_seconds

        return None

    @staticmethod
    def format_progress_value(progress_type, value):
        """Format a progress value based on type for storage."""
        if progress_type == "percent":
            # Remove % sign if present and ensure it's a whole number
            if isinstance(value, str):
                value = value.replace("%", "")
            return str(int(float(value)))
        elif progress_type == "page":
            # Ensure it's a whole number
            return str(int(float(value)))
        elif progress_type == "audio":
            # Keep as is for now (already validated)
            return value
        return str(value)
