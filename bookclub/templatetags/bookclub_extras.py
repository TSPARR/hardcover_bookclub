import math

from django import template
from django.contrib.auth.models import User

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
