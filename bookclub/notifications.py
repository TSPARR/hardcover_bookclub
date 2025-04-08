# notifications.py
import json
import logging
import os
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)

# Get VAPID keys from environment variables
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS = {
    "sub": f"mailto:{os.environ.get('VAPID_CONTACT_EMAIL', 'your-email@example.com')}"
}


def send_push_notification(user, title, body, url=None, icon=None):
    """
    Send a push notification to a user

    Args:
        user: User object to send notification to
        title: Title of the notification
        body: Body text of the notification
        url: URL to open when notification is clicked
        icon: URL to the notification icon
    """
    try:
        user_profile = user.profile

        # Check if user has enabled notifications
        if not user_profile.enable_notifications:
            logger.info(f"Notifications not enabled for user {user.username}")
            return False

        if not user_profile.push_subscription:
            logger.info(f"No push subscription for user {user.username}")
            return False

        # Check if VAPID keys are configured
        if not VAPID_PRIVATE_KEY:
            logger.error("VAPID_PRIVATE_KEY is not set in environment variables")
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
        logger.info(f"Sending push notification to {user.username}: {title}")

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
