"""
API views that return JSON responses
"""

import logging
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from ..hardcover_api import HardcoverAPI

logger = logging.getLogger(__name__)


@login_required
def get_hardcover_progress(request, hardcover_id):
    """API endpoint to get a user's reading progress from Hardcover"""
    try:
        progress_data = HardcoverAPI.get_reading_progress(
            hardcover_id, user=request.user
        )
        return JsonResponse(progress_data)
    except Exception as e:
        logger.exception(f"Error fetching Hardcover progress: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)
