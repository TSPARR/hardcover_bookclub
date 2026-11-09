"""Formatting utilities for common data transformations."""


def format_ordinal(n: int) -> str:
    """
    Convert an integer to its ordinal string representation.

    Args:
        n: The number to convert

    Returns:
        String like "1st", "2nd", "3rd", "4th", etc.

    Examples:
        >>> format_ordinal(1)
        '1st'
        >>> format_ordinal(22)
        '22nd'
        >>> format_ordinal(13)
        '13th'
    """
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def format_audio_duration(seconds: int) -> str:
    """
    Convert seconds to a human-readable audio duration string.

    Args:
        seconds: Total duration in seconds

    Returns:
        String in format "Xh Ym" (e.g., "5h 23m")
        Returns None if seconds is None or 0

    Examples:
        >>> format_audio_duration(3600)
        '1h 0m'
        >>> format_audio_duration(7380)
        '2h 3m'
        >>> format_audio_duration(None)

    """
    if not seconds:
        return None
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    return f"{hours}h {minutes}m"


def get_reading_format_name(format_id: int) -> str:
    """
    Map Hardcover reading_format_id to human-readable format name.

    Args:
        format_id: The reading format ID from Hardcover API
                   1 = physical book
                   2 = audiobook
                   4 = ebook

    Returns:
        String representation of the format

    Examples:
        >>> get_reading_format_name(1)
        'physical'
        >>> get_reading_format_name(2)
        'audio'
        >>> get_reading_format_name(99)
        'unknown'
    """
    format_map = {
        1: "physical",
        2: "audio",
        4: "ebook",
    }
    return format_map.get(format_id, "unknown")
