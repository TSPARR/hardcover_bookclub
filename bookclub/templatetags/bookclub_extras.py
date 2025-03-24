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
