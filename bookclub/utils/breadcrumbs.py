"""
Breadcrumb utility functions for consistent navigation.
"""

from django.urls import reverse


def breadcrumb_home():
    """Standard home breadcrumb."""
    return {"title": "Home", "url": reverse("home")}


def breadcrumb_group(group, include_link=True):
    """Standard group breadcrumb."""
    return {
        "title": group.name,
        "url": reverse("group_detail", args=[group.id]) if include_link else None,
    }


def breadcrumb_book(book, include_link=False):
    """Standard book breadcrumb using short title."""
    return {
        "title": book.short_title,
        "url": reverse("book_detail", args=[book.id]) if include_link else None,
    }
