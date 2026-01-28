"""
User profile related views
"""

import json
import logging

import requests
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from ..forms import (
    HomePagePreferenceForm,
    NotificationPreferencesForm,
    ProfileSettingsForm,
)
from ..hardcover_api import HardcoverAPI
from ..models import BookGroup
from ..notifications import is_push_enabled, send_push_notification

logger = logging.getLogger(__name__)

# Get VAPID settings from Django settings
VAPID_PUBLIC_KEY = getattr(settings, "VAPID_PUBLIC_KEY", "")


@login_required
def profile_settings(request):
    if request.method == "POST":
        form = ProfileSettingsForm(request.POST, instance=request.user.profile)
        notification_form = NotificationPreferencesForm(
            request.POST, user=request.user, push_enabled=is_push_enabled()
        )
        home_page_form = HomePagePreferenceForm(request.POST, user=request.user)

        api_key_valid = True
        api_key_message = None

        # Process main profile form with API key
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
                        # API key is valid - save will happen below
                        pass
                    else:
                        api_key_valid = False
                        api_key_message = "Invalid API key. Please check and try again."
                except Exception as e:
                    api_key_valid = False
                    api_key_message = f"Could not validate API key: {str(e)}"

        # Determine if we should save the forms
        should_save_api_key = form.is_valid() and (
            api_key_valid or not form.cleaned_data["hardcover_api_key"]
        )
        should_save_notifications = notification_form.is_valid()
        should_save_home_page = home_page_form.is_valid()

        # Save the forms if appropriate
        if should_save_api_key:
            form.save()

        if should_save_notifications:
            notification_form.save()

        if should_save_home_page:
            home_page_form.save()

        # Display appropriate messages
        if not api_key_valid and api_key_message:
            messages.error(request, api_key_message)
        elif should_save_api_key or should_save_notifications or should_save_home_page:
            # Only show one success message if any form was saved
            messages.success(
                request, "Your profile settings have been updated successfully."
            )

        return redirect("profile_settings")
    else:
        # GET request - initialize forms
        form = ProfileSettingsForm(instance=request.user.profile)

        # Initialize notification form with current preferences
        initial_data = {
            "enable_notifications": request.user.profile.enable_notifications,
        }

        # Add notification preferences
        preferences = request.user.profile.notification_preferences or {}
        initial_data["notify_new_active_books"] = preferences.get(
            "new_active_books", False
        )
        initial_data["notify_new_dollar_bets"] = preferences.get(
            "new_dollar_bets", False
        )
        initial_data["notify_bet_accepted"] = preferences.get("bet_accepted", False)
        initial_data["notify_bet_added_to"] = preferences.get("bet_added_to", False)
        initial_data["notify_bet_resolved"] = preferences.get("bet_resolved", False)

        notification_form = NotificationPreferencesForm(
            initial=initial_data, user=request.user, push_enabled=is_push_enabled()
        )

        # Initialize home page preference form
        home_pref = request.user.profile.get_home_page_preference()
        home_page_form = HomePagePreferenceForm(
            initial={
                "preference_type": home_pref.get("type", "default"),
                "group_id": (
                    str(home_pref.get("group_id", ""))
                    if home_pref.get("group_id")
                    else ""
                ),
            },
            user=request.user,
        )

    # Check if the user is a member of any groups with dollar bets enabled
    user_has_dollar_bet_groups = False

    # Only check group membership if the feature is globally enabled
    if settings.ENABLE_DOLLAR_BETS:
        # Get all groups the user is a member of
        user_groups = BookGroup.objects.filter(members=request.user)
        for group in user_groups:
            if group.is_dollar_bets_enabled():
                user_has_dollar_bet_groups = True
                break

    context = {
        "form": form,
        "notification_form": notification_form,
        "home_page_form": home_page_form,
        "push_notifications_enabled": is_push_enabled(),
        "user_has_dollar_bet_groups": user_has_dollar_bet_groups,
    }

    return render(request, "bookclub/profile_settings.html", context)


@login_required
def get_vapid_public_key(request):
    """Return the VAPID public key for push subscriptions"""
    if not is_push_enabled():
        logger.error("Push notifications are not enabled in settings")
        return HttpResponse(status=501)  # Not Implemented
    return HttpResponse(VAPID_PUBLIC_KEY)


@login_required
@csrf_protect
@require_POST
def push_subscribe(request):
    """Store a new push subscription for the user"""
    if not is_push_enabled():
        return JsonResponse(
            {"status": "error", "message": "Push notifications are not enabled"},
            status=501,
        )

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
    if not is_push_enabled():
        return JsonResponse(
            {"status": "error", "message": "Push notifications are not enabled"},
            status=501,
        )

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
    if not is_push_enabled():
        return JsonResponse(
            {"status": "error", "message": "Push notifications are not enabled"},
            status=501,
        )

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
