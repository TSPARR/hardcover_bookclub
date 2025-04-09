# Adding New Notification Types Guide

This guide explains how to add new notification types to the Book Club application and addresses potential issues that might occur when introducing new notification preferences.

## 1. Update the NotificationPreferencesForm

Add the new notification type to the form in your forms module:

```python
class NotificationPreferencesForm(forms.Form):
    # Existing fields
    enable_notifications = forms.BooleanField(
        required=False,
        label="Enable Push Notifications",
        help_text="Receive notifications from Book Club in your browser"
    )
    
    notify_new_active_books = forms.BooleanField(
        required=False,
        label="New Active Books",
        help_text="Get notified when a new book becomes active in your groups"
    )
    
    # Add your new notification type here
    notify_new_comments = forms.BooleanField(
        required=False,
        label="New Comments",
        help_text="Get notified when someone comments on a book you're reading"
    )
    
    # Update the save method to include your new notification type
    def save(self):
        if not self.user or not self.is_valid():
            return False

        profile = self.user.profile
        profile.enable_notifications = self.cleaned_data.get(
            "enable_notifications", False
        )

        # Create or update preferences dictionary - IMPORTANT: Handle None case
        if profile.notification_preferences is None:
            profile.notification_preferences = {}
            
        # Update specific preferences
        profile.notification_preferences.update({
            'new_active_books': self.cleaned_data.get('notify_new_active_books', False),
            'new_comments': self.cleaned_data.get('notify_new_comments', False)  # Add this line
            # Add any other notification types here
        })
        
        # Save profile
        profile.save(update_fields=['enable_notifications', 'notification_preferences'])
        return True
```

## 2. Update the Notification Types in notifications.py

Add your new notification type to the NOTIFICATION_TYPES dictionary:

```python
# Define notification types
NOTIFICATION_TYPES = {
    'new_active_books': 'New Active Books',
    'new_comment': 'New Comments',
    'comment_reply': 'Comment Replies',
    # Add your new notification type here
    'new_dollar_bet': 'New Dollar Bets'
}
```

## 3. Update the profile_views.py

Update the initial data for the notification form to include your new notification type:

```python
# Initialize notification form with current preferences
initial_data = {
    "enable_notifications": request.user.profile.enable_notifications,
}

# Add notification preferences with proper fallback defaults
preferences = request.user.profile.notification_preferences or {}

# IMPORTANT: Always use get() with a default value for each preference
initial_data['notify_new_active_books'] = preferences.get('new_active_books', False)
initial_data['notify_new_comments'] = preferences.get('new_comments', False)  # Add this line
```

## 4. Uncomment and Update the HTML Template

In the `notification_settings.html` template, uncomment and update the placeholder for your new notification type:

```html
<!-- New Comments notification -->
<div class="form-check mb-2">
    <input type="checkbox" class="form-check-input" id="{{ notification_form.notify_new_comments.id_for_label }}" 
        name="{{ notification_form.notify_new_comments.html_name }}" 
        {% if notification_form.notify_new_comments.value %}checked{% endif %}>
    <label class="form-check-label" for="{{ notification_form.notify_new_comments.id_for_label }}">
        {{ notification_form.notify_new_comments.label }}
    </label>
    <div class="form-text">{{ notification_form.notify_new_comments.help_text }}</div>
</div>
```

## 5. Update the Hidden Fields

Don't forget to add the hidden fields in `api_settings.html`:

```html
<!-- Hidden notification form fields to preserve them when submitting this form -->
{% if notification_form %}
    <input type="hidden" name="{{ notification_form.enable_notifications.html_name }}" 
        value="{% if notification_form.enable_notifications.value %}on{% endif %}">
    <input type="hidden" name="{{ notification_form.notify_new_active_books.html_name }}" 
        value="{% if notification_form.notify_new_active_books.value %}on{% endif %}">
    <input type="hidden" name="{{ notification_form.notify_new_comments.html_name }}" 
        value="{% if notification_form.notify_new_comments.value %}on{% endif %}">
    <!-- Add similar hidden fields for any future notification types -->
{% endif %}
```

## 6. Update the Sending Code

Update your code that sends notifications to include the notification type:

```python
# Example: Sending a notification for a new comment
send_push_notification(
    user=comment.book.user,
    title=f"New Comment on {comment.book.title}",
    body=f"{comment.user.username} commented: {comment.text[:50]}...",
    url=request.build_absolute_uri(reverse("book_detail", args=[comment.book.id])),
    icon=comment.book.cover_image_url if book.cover_image_url else None,
    notification_type='new_comments'  # Use the notification type key
)
```

## 7. Create a Data Migration (IMPORTANT)

When adding new notification types, you should create a data migration to update existing user profiles:

```python
# Command to create the migration:
# python manage.py makemigrations bookclub --empty --name add_new_notification_type

from django.db import migrations

def update_notification_preferences(apps, schema_editor):
    """Add new notification types to existing user profiles"""
    UserProfile = apps.get_model('bookclub', 'UserProfile')
    
    # Get all profiles that have notifications enabled
    profiles = UserProfile.objects.filter(enable_notifications=True)
    
    for profile in profiles:
        # Ensure the notification_preferences dictionary exists
        if profile.notification_preferences is None:
            profile.notification_preferences = {}
        
        # Add new notification type with default=False (opt-in) if it doesn't exist yet
        if "new_comments" not in profile.notification_preferences:
            profile.notification_preferences["new_comments"] = False
        
        # Make sure we preserve the main notification toggle
        profile.save()

class Migration(migrations.Migration):
    dependencies = [
        ('bookclub', 'previous_migration'),  # Update with your actual previous migration
    ]

    operations = [
        migrations.RunPython(update_notification_preferences),
    ]
```

## Why Migrations Are Important

### Preventing Toggled-Off Notifications

When you add new notification types, existing users may experience issues:

1. The main push notification toggle might get turned off if your code doesn't handle missing fields properly
2. New notification types won't exist in users' preferences dictionaries until they visit the settings page

A data migration preemptively fixes these issues by:
- Adding the new notification types to all existing profiles
- Ensuring they have proper default values (typically False for opt-in)
- Preserving the main notification toggle state

### Best Practices for Adding New Notification Types

To prevent issues when adding new notification types:

1. **Always use default values**: Use `preferences.get('key', False)` instead of direct access
2. **Handle null preferences**: Check if `notification_preferences` is None before updating
3. **Create a data migration**: Update existing profiles whenever you add new notification types
4. **Keep defaults consistent**: Decide if new notifications should be opt-in (False) or opt-out (True) by default

If you follow these practices, users won't experience unexpected changes to their notification settings when you add new notification types.

## Template for New Notification Type Checkbox

Use this template for adding a new notification type to the profile_notification_settings.html file:

```html
<!-- [NAME] notification -->
<div class="form-check mb-2">
    <input type="checkbox" class="form-check-input" id="{{ notification_form.[field_name].id_for_label }}" 
        name="{{ notification_form.[field_name].html_name }}" 
        {% if notification_form.[field_name].value %}checked{% endif %}>
    <label class="form-check-label" for="{{ notification_form.[field_name].id_for_label }}">
        {{ notification_form.[field_name].label }}
    </label>
    <div class="form-text">{{ notification_form.[field_name].help_text }}</div>
</div>
```

Replace `[NAME]` with a descriptive name, and `[field_name]` with the actual field name from your form.