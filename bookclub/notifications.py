import json
import logging

from django.conf import settings
from pywebpush import WebPushException, webpush

logger = logging.getLogger(__name__)

# Get VAPID settings from Django settings
VAPID_PRIVATE_KEY = getattr(settings, "VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS = {
    "sub": f"mailto:{getattr(settings, 'VAPID_CONTACT_EMAIL', 'your-email@example.com')}"
}

# Define notification types
NOTIFICATION_TYPES = {
    "new_active_books": "New Active Books",
    # Add more notification types as needed
}


def is_push_enabled():
    """
    Check if push notifications are properly configured
    """
    return getattr(settings, "PUSH_NOTIFICATIONS_ENABLED", False)


def send_push_notification(
    user, title, body, url=None, icon=None, notification_type=None
):
    """
    Send a push notification to a user

    Args:
        user: User object to send notification to
        title: Title of the notification
        body: Body text of the notification
        url: URL to open when notification is clicked
        icon: URL to the notification icon
        notification_type: Type of notification (from NOTIFICATION_TYPES)
    """
    # First check if push notifications are enabled globally
    if not is_push_enabled():
        logger.info("Push notifications not enabled in settings")
        return False

    try:
        user_profile = user.profile

        # Check if user has enabled notifications globally
        if not user_profile.enable_notifications:
            logger.info(f"Notifications not enabled for user {user.username}")
            return False

        if not user_profile.push_subscription:
            logger.info(f"No push subscription for user {user.username}")
            return False

        # Check for specific notification type preference if provided
        if notification_type:
            # Get preferences, defaulting to empty dict if None
            preferences = user_profile.notification_preferences or {}

            # Check if this specific notification type is enabled
            if not preferences.get(notification_type, False):
                logger.info(
                    f"User {user.username} has opted out of {notification_type} notifications"
                )
                return False

        # Prepare the notification data
        data = {
            "title": title,
            "body": body,
            "url": url or "/",
        }

        if icon:
            data["icon"] = icon

        # Get the subscription info
        try:
            subscription_info = json.loads(user_profile.push_subscription)
        except json.JSONDecodeError:
            logger.error(f"Invalid subscription JSON for user {user.username}")
            user_profile.push_subscription = None
            user_profile.save()
            return False

        # Log that we're sending a notification
        logger.info(
            f"Sending push notification to {user.username}: {title} (type: {notification_type or 'general'})"
        )

        # Send the notification
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(data),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )

        logger.info(f"Successfully sent notification to {user.username}")
        return True
    except WebPushException as e:
        if e.response and e.response.status_code == 410:
            # Subscription expired
            logger.info(f"Subscription expired for user {user.username}")
            user_profile.push_subscription = None
            user_profile.enable_notifications = False
            user_profile.save()
        else:
            logger.exception(f"WebPush error for user {user.username}: {str(e)}")
        return False
    except Exception as e:
        logger.exception(f"Error sending notification to {user.username}: {str(e)}")
        return False
