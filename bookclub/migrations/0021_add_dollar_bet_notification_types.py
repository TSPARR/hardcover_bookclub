from django.db import migrations


def add_dollar_bet_notification_types(apps, schema_editor):
    """
    Add new dollar bet notification types to existing user profiles
    and ensure main notification toggle remains enabled for users
    who have push subscriptions.
    """
    UserProfile = apps.get_model("bookclub", "UserProfile")

    # Get all profiles
    profiles = UserProfile.objects.all()

    for profile in profiles:
        # Skip if no notification preferences and notifications not enabled
        if not profile.notification_preferences and not profile.enable_notifications:
            continue

        # Ensure notification_preferences exists
        if profile.notification_preferences is None:
            profile.notification_preferences = {}

        # Add new notification types as opt-in (False) if they don't exist yet
        if "new_dollar_bets" not in profile.notification_preferences:
            profile.notification_preferences["new_dollar_bets"] = False

        if "bet_accepted" not in profile.notification_preferences:
            profile.notification_preferences["bet_accepted"] = False

        if "bet_added_to" not in profile.notification_preferences:
            profile.notification_preferences["bet_added_to"] = False

        if "bet_resolved" not in profile.notification_preferences:
            profile.notification_preferences["bet_resolved"] = False

        # Fix any users who had push subscriptions but somehow got their toggle turned off
        if profile.push_subscription and not profile.enable_notifications:
            profile.enable_notifications = True

        profile.save()


class Migration(migrations.Migration):

    dependencies = [
        ("bookclub", "0020_userprofile_notification_preferences"),
    ]

    operations = [
        migrations.RunPython(add_dollar_bet_notification_types),
    ]
