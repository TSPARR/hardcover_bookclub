from django.conf import settings


def bookclub_settings(request):
    """
    Adds bookclub settings to the context of all templates
    """
    return {
        "ENABLE_DOLLAR_BETS": settings.ENABLE_DOLLAR_BETS,
        "PUSH_NOTIFICATIONS_ENABLED": settings.PUSH_NOTIFICATIONS_ENABLED,
        "KAVITA_ENABLED": settings.KAVITA_ENABLED,
        "PLEX_ENABLED": settings.PLEX_ENABLED,
    }
