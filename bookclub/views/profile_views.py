"""
User profile related views
"""

import json
import logging
import os

import requests
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from ..forms import ProfileSettingsForm
from ..hardcover_api import HardcoverAPI
from ..notifications import send_push_notification

logger = logging.getLogger(__name__)

# Get VAPID keys from environment variables
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS = {
    "sub": f"mailto:{os.environ.get('VAPID_CONTACT_EMAIL', 'your-email@example.com')}"
}


@login_required
def profile_settings(request):
    if request.method == "POST":
        form = ProfileSettingsForm(request.POST, instance=request.user.profile)
        if form.is_valid():
            api_key = form.cleaned_data["hardcover_api_key"]

            # Only validate if an API key was provided
            if api_key:
                test_query = """
                query ValidateAuth {
                  me {
                    id
                    username
                  }
                }
                """

                headers = {"Authorization": f"Bearer {api_key}"}
                try:
                    response = requests.post(
                        HardcoverAPI.BASE_URL,
                        headers=headers,
                        json={"query": test_query},
                        timeout=5,
                    )

                    data = response.json()
                    if (
                        response.status_code == 200
                        and "data" in data
                        and "me" in data["data"]
                    ):
                        form.save()
                        messages.success(
                            request,
                            "Your profile settings have been updated successfully.",
                        )
                    else:
                        messages.error(
                            request, "Invalid API key. Please check and try again."
                        )
                except Exception as e:
                    messages.error(request, f"Could not validate API key: {str(e)}")
            else:
                # No API key provided, just save the form (will clear existing key)
                form.save()
                messages.success(request, "Your profile settings have been updated.")

            return redirect("profile_settings")
    else:
        form = ProfileSettingsForm(instance=request.user.profile)

    return render(request, "bookclub/profile_settings.html", {"form": form})


@login_required
def get_vapid_public_key(request):
    """Return the VAPID public key for push subscriptions"""
    if not VAPID_PUBLIC_KEY:
        logger.error("VAPID_PUBLIC_KEY environment variable is not set")
        return HttpResponse(status=501)  # Not Implemented
    return HttpResponse(VAPID_PUBLIC_KEY)


@login_required
@csrf_protect
@require_POST
def push_subscribe(request):
    """Store a new push subscription for the user"""
    try:
        subscription_json = json.loads(request.body.decode("utf-8"))

        # Log what we're receiving
        logger.info(f"Received subscription from user {request.user.username}")

        # Store the subscription in the user's profile
        user_profile = request.user.profile
        user_profile.push_subscription = json.dumps(subscription_json)
        user_profile.enable_notifications = True
        user_profile.save()

        # Log the update
        logger.info(
            f"Updated user profile for {request.user.username}, notifications enabled: {user_profile.enable_notifications}"
        )

        return JsonResponse({"status": "success"})
    except Exception as e:
        logger.exception(
            f"Error saving push subscription for user {request.user.username}"
        )
        return JsonResponse({"status": "error", "message": str(e)}, status=400)


@login_required
@csrf_protect
@require_POST
def push_unsubscribe(request):
    """Remove a push subscription for the user"""
    try:
        data = json.loads(request.body.decode("utf-8"))
        endpoint = data.get("endpoint")

        # Find and update the user's profile
        user_profile = request.user.profile

        # Clear the subscription if it matches the endpoint
        if user_profile.push_subscription:
            stored_subscription = json.loads(user_profile.push_subscription)
            if stored_subscription.get("endpoint") == endpoint:
                user_profile.push_subscription = None
                user_profile.enable_notifications = False
                user_profile.save()

        return JsonResponse({"status": "success"})
    except Exception as e:
        logger.exception("Error removing push subscription")
        return JsonResponse({"status": "error", "message": str(e)}, status=400)


@login_required
@csrf_protect
@require_POST
def test_push_notification(request):
    """Send a test notification to the current user"""
    user_profile = request.user.profile

    # Check if the user has enabled notifications
    if not user_profile.enable_notifications or not user_profile.push_subscription:
        return JsonResponse(
            {"status": "error", "message": "Notifications not enabled"}, status=400
        )

    # Send a test notification
    success = send_push_notification(
        user=request.user,
        title="Test Notification",
        body="Your notifications are working! This is a test message from Book Club.",
        url=request.build_absolute_uri("/"),
        icon="/static/bookclub/images/icon-192.png",
    )

    if success:
        return JsonResponse({"status": "success"})
    else:
        return JsonResponse(
            {"status": "error", "message": "Failed to send test notification"},
            status=500,
        )
