from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

from .models import BookGroup, Comment, GroupInvitation, UserProfile


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ["text"]
        widgets = {
            "text": forms.Textarea(attrs={"class": "form-control", "rows": 3}),
        }


class BookSearchForm(forms.Form):
    query = forms.CharField(label="Search for books", max_length=100)


class UserRegistrationForm(UserCreationForm):
    """Form for user registration with invitation code"""

    first_name = forms.CharField(
        max_length=30,
        required=True,
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )
    last_name = forms.CharField(
        max_length=30,
        required=True,
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )
    email = forms.EmailField(
        required=True, widget=forms.EmailInput(attrs={"class": "form-control"})
    )
    invitation_code = forms.UUIDField(
        required=True,
        widget=forms.TextInput(attrs={"class": "form-control"}),
        help_text="Enter the invitation code you received",
    )

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "username",
            "email",
            "password1",
            "password2",
            "invitation_code",
        ]
        widgets = {
            "username": forms.TextInput(attrs={"class": "form-control"}),
        }

    def clean_invitation_code(self):
        """Validate the invitation code"""
        code = self.cleaned_data.get("invitation_code")

        try:
            invitation = GroupInvitation.objects.get(code=code)

            # Check if invitation is valid
            if not invitation.is_valid:
                if invitation.is_used:
                    raise ValidationError("This invitation has already been used.")
                elif invitation.is_revoked:
                    raise ValidationError("This invitation has been revoked.")
                else:
                    raise ValidationError("This invitation has expired.")

            # Store the invitation object for later use
            self.invitation = invitation
            return code

        except GroupInvitation.DoesNotExist:
            raise ValidationError("Invalid invitation code.")

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]

        if commit:
            user.save()

            # Mark invitation as used
            self.invitation.is_used = True
            self.invitation.save()

            # Add user to the group
            self.invitation.group.members.add(user)

        return user


class ProfileSettingsForm(forms.ModelForm):
    hardcover_api_key = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 3, "cols": 40}),
        required=False,
        help_text="Paste your Hardcover API bearer token here. It will be stored securely.",
    )
    enable_notifications = forms.BooleanField(
        required=False,
        help_text="Receive notifications for new comments, book progress updates, and group activities.",
    )

    class Meta:
        model = UserProfile
        fields = ["hardcover_api_key", "enable_notifications"]


class GroupForm(forms.ModelForm):
    class Meta:
        model = BookGroup
        fields = ["name", "description", "is_public"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control"}),
            "description": forms.Textarea(attrs={"class": "form-control", "rows": 4}),
            "is_public": forms.CheckboxInput(attrs={"class": "form-check-input"}),
        }


class NotificationPreferencesForm(forms.Form):
    """Form for managing user notification preferences"""

    # Main notification toggle
    enable_notifications = forms.BooleanField(
        required=False,
        label="Enable Push Notifications",
        help_text="Receive notifications from Book Club in your browser",
    )

    # Specific notification types
    notify_new_active_books = forms.BooleanField(
        required=False,
        label="New Active Books",
        help_text="Get notified when a new book becomes active in your groups",
    )

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        # Get push_enabled from the view instead of directly from settings
        self.push_enabled = kwargs.pop("push_enabled", True)
        super().__init__(*args, **kwargs)

        # Disable all fields if push notifications aren't enabled
        if not self.push_enabled:
            for field in self.fields.values():
                field.disabled = True
                field.help_text = "Push notifications are not enabled on this server"

    def save(self):
        """Save the notification preferences to the user's profile"""
        if not self.user or not self.is_valid():
            return False

        profile = self.user.profile
        profile.enable_notifications = self.cleaned_data.get(
            "enable_notifications", False
        )

        # Create or update preferences dictionary
        if not profile.notification_preferences:
            profile.notification_preferences = {}

        # Update specific preferences
        profile.notification_preferences.update(
            {
                "new_active_books": self.cleaned_data.get(
                    "notify_new_active_books", False
                )
            }
        )

        # Save profile
        profile.save(update_fields=["enable_notifications", "notification_preferences"])
        return True
