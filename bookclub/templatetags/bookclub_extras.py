import math

from django import template

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
def get_item(dictionary, key):
    """Get an item from a dictionary using template variables"""
    return dictionary.get(key, [])


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
