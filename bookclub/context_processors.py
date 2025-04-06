from django.conf import settings


def bookclub_settings(request):
    return {"ENABLE_DOLLAR_BETS": settings.ENABLE_DOLLAR_BETS}
