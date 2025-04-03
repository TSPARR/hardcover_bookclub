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
