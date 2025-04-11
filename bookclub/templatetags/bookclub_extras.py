import json
import math

from django import template
from django.contrib.auth.models import User
from django.utils.safestring import mark_safe

register = template.Library()


@register.filter
def is_admin(group, user):
    """Check if a user is an admin of a group"""
    return group.is_admin(user)


@register.filter
def is_member(group, user):
    """Check if a user is a member of a group"""
    return group.is_member(user)


@register.filter
def rejectattr(value, arg):
    """Filter a queryset or list based on an attribute being False."""
    if hasattr(value, "filter"):
        # This is a queryset
        kwargs = {arg: False}
        return value.filter(**kwargs)
    else:
        # This is a list
        return [item for item in value if not getattr(item, arg, False)]


@register.filter
def floor(value):
    """Returns the floor of a number."""
    try:
        return math.floor(float(value))
    except (ValueError, TypeError):
        return 0


@register.filter
def get_username_from_id(user_id):
    """Convert a user ID to a username."""
    try:
        user = User.objects.get(id=user_id)
        return user.username
    except User.DoesNotExist:
        return "Unknown User"
    except (ValueError, TypeError):
        return "Invalid ID"


@register.filter
def get_item(dictionary, key):
    """Get an item from a dictionary by key."""
    if not dictionary:
        return None
    return dictionary.get(key)


@register.filter
def div(value, arg):
    """Divide the value by the argument."""
    try:
        return float(value) / float(arg)
    except (ValueError, ZeroDivisionError):
        return 0


@register.filter
def mul(value, arg):
    """Multiply the value by the argument."""
    try:
        return float(value) * float(arg)
    except ValueError:
        return 0


@register.filter
def get_attr(obj, attr_name):
    """Get an attribute from an object by name."""
    if not obj:
        return None
    return getattr(obj, attr_name, None)


@register.filter
def split(value, separator):
    """
    Split a string by a given separator

    Usage in template:
    {{ some_string|split:":" }}
    """
    return value.split(separator)


@register.filter
def trim(value):
    """
    Remove leading and trailing whitespace

    Usage in template:
    {{ some_string|trim }}
    """
    return value.strip()


@register.filter
def map(obj_list, attribute):
    """
    Extract a specific attribute from a list of objects

    Example:
    {{ users|map:'username' }} will return a list of usernames

    Args:
        obj_list: List of objects
        attribute: Attribute name to extract

    Returns:
        List of attribute values
    """
    if not obj_list:
        return []

    # Handle nested attributes with dot notation (e.g., 'user.username')
    if "." in attribute:
        parts = attribute.split(".")
        result = []
        for obj in obj_list:
            current = obj
            valid = True
            for part in parts:
                if hasattr(current, part):
                    current = getattr(current, part)
                else:
                    valid = False
                    break
            if valid:
                result.append(current)
        return result

    # Simple attribute access
    return [getattr(obj, attribute) for obj in obj_list if hasattr(obj, attribute)]


@register.filter
def books_with_ratings(book_sequence):
    """
    Filter the book sequence to only include books with valid ratings.
    Handles rating data as dictionaries (not objects).
    Returns a list of (rating_value, books) tuples where each book has rating data.
    """
    result = []

    # Group books by their rating
    rating_groups = {}

    for book_tuple in book_sequence:
        if len(book_tuple) >= 4:
            # Extract data from the tuple
            picker_id, book, streak, rating_data = book_tuple

            # Skip books without rating data
            if not rating_data:
                continue

            # Check if rating data has the right keys (dictionary access)
            if "avg_rating" not in rating_data or "count" not in rating_data:
                continue

            # Skip books with fewer than 2 ratings
            if rating_data["count"] < 2:
                continue

            # Get the rating value
            rating_value = rating_data["avg_rating"]

            # Add to the appropriate rating group
            if rating_value not in rating_groups:
                rating_groups[rating_value] = []

            rating_groups[rating_value].append(book_tuple)

    # Convert the dictionary to a sorted list of (rating, books) tuples
    for rating_value in sorted(rating_groups.keys(), reverse=True):
        result.append((rating_value, rating_groups[rating_value]))

    return result


@register.filter
def filter_by_status(queryset, status):
    """Filter a queryset by status"""
    return queryset.filter(status=status)


@register.filter
def filter_by_multiple_statuses(queryset, statuses):
    """Filter a queryset by multiple status values
    Usage: queryset|filter_by_multiple_statuses:'won,lost'
    """
    status_list = statuses.split(",")
    return queryset.filter(status__in=status_list)


@register.filter
def exclude_status(queryset, status):
    """Filter a queryset to exclude items with the given status"""
    return queryset.exclude(status=status)


@register.filter
def to_float(value):
    """Converts a value to a float"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return ""


@register.filter
def subtract(value, arg):
    """Subtracts arg from value"""
    try:
        return float(value) - float(arg)
    except (ValueError, TypeError):
        return ""


@register.filter
def stringifyjson(value):
    """
    Convert a Python object to a JSON string for use in HTML data attributes.

    Args:
        value: The Python object to convert

    Returns:
        JSON string representation, safe for inclusion in HTML
    """

    # Convert Python object to JSON string
    # We need to handle Django model instances specially
    def serialize_object(obj):
        if hasattr(obj, "__dict__"):
            # For model instances, extract relevant attributes
            if hasattr(obj, "username"):  # User object
                return {"id": obj.id, "username": obj.username}
            elif hasattr(obj, "title"):  # Book object
                return {"id": obj.id, "title": obj.title}
            else:
                # Generic object serialization
                return {
                    k: serialize_object(v)
                    for k, v in obj.__dict__.items()
                    if not k.startswith("_")
                }
        elif isinstance(obj, (list, tuple)):
            return [serialize_object(item) for item in obj]
        elif isinstance(obj, dict):
            return {k: serialize_object(v) for k, v in obj.items()}
        else:
            return obj

    # First serialize the object to get a structure we can convert to JSON
    serialized = serialize_object(value)

    # Then convert to JSON string
    try:
        json_str = json.dumps(serialized)
        # Escape quotes for HTML attributes
        json_str = json_str.replace('"', "&quot;")
        return mark_safe(json_str)
    except (TypeError, ValueError):
        # If serialization fails, return empty object
        return "{}"


@register.filter
def linebreaks_p(value):
    """
    Convert newlines (\n\n) to paragraph tags, similar to Django's built-in
    linebreaks filter but with better handling of consecutive newlines.
    """
    if not value:
        return ""

    # Split on double newlines to create paragraphs
    paragraphs = value.split("\n\n")
    # Filter out empty paragraphs and wrap each in <p> tags
    html = "".join([f"<p>{p.strip()}</p>" for p in paragraphs if p.strip()])
    return mark_safe(html)
