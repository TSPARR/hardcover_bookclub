def is_auto_sync_enabled(request, book_id):
    """
    Check if auto-sync is enabled for a book based on browser localStorage

    Since localStorage is client-side, we can only check this via JavaScript.
    For server-side rendering, we'll pass a parameter to check JavaScript localStorage
    on page load and update UI elements accordingly.

    Args:
        request: HTTP request object
        book_id: Book ID to check

    Returns:
        bool: Default to False since we can't check localStorage server-side
    """
    # We'll use a simple cookie-based check as a fallback
    cookie_name = f"auto_sync_{book_id}"
    return request.COOKIES.get(cookie_name) == "true"
