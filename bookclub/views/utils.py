"""
Utility functions for views that can be used across multiple view files.
"""

import logging

logger = logging.getLogger(__name__)


def _get_progress_value_for_sorting(comment):
    """
    Helper function to convert different progress types to comparable values
    Returns a value between 0 and 100 representing the reading progress
    """
    if comment.hardcover_percent is not None:
        return comment.hardcover_percent

    if comment.progress_type == "percent":
        try:
            # Extract numeric part from percentage string (e.g., "75%" -> 75)
            return float(comment.progress_value.replace("%", ""))
        except (ValueError, AttributeError):
            return 0

    elif comment.progress_type == "page":
        # If we have book pages and current page, calculate percentage
        if comment.book.pages and comment.hardcover_current_page:
            return (comment.hardcover_current_page / comment.book.pages) * 100

        # Try to parse progress_value as a page number
        try:
            page = int(comment.progress_value)
            if comment.book.pages:
                return (page / comment.book.pages) * 100
            return page  # If no total pages, just use the page number
        except (ValueError, AttributeError):
            return 0

    elif comment.progress_type == "audio":
        # For audio, convert to a percentage if we have total audio duration
        if comment.hardcover_current_position and comment.book.audio_seconds:
            return (
                comment.hardcover_current_position / comment.book.audio_seconds
            ) * 100

        # Otherwise, just use a default value since audio times are hard to compare
        return 50  # Middle value

    return 0  # Default case


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
