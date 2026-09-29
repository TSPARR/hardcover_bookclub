"""
Authentication-related views like login, registration with invitation, etc.
"""

import logging

from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.views import LoginView
from django.shortcuts import redirect, render

from ..forms import UserRegistrationForm
from ..models import GroupInvitation

logger = logging.getLogger(__name__)


class CustomLoginView(LoginView):
    """Custom login view that redirects to user's preferred home page"""

    def get_success_url(self):
        # Check for ?next= parameter first (standard Django behavior)
        redirect_to = self.request.GET.get(self.redirect_field_name, "")
        if redirect_to:
            return redirect_to

        # Use user's home page preference
        if self.request.user.is_authenticated:
            return self.request.user.profile.get_home_redirect_url()

        # Fallback to default
        return super().get_success_url()


def landing_page(request):
    # If user is already logged in, redirect to their preferred home
    if request.user.is_authenticated:
        return redirect(request.user.profile.get_home_redirect_url())
    # Not authenticated - redirect to login
    return redirect("login")


def join_with_invite(request, invite_code):
    """Handle joining with an invitation code"""

    # If user is already logged in, redirect to home
    if request.user.is_authenticated:
        return redirect("home")

    # Validate invitation code
    try:
        invitation = GroupInvitation.objects.get(code=invite_code)

        # Check if invitation is valid
        if not invitation.is_valid:
            if invitation.is_used:
                messages.error(request, "This invitation has already been used.")
            elif invitation.is_revoked:
                messages.error(request, "This invitation has been revoked.")
            else:
                messages.error(request, "This invitation has expired.")
            return redirect("landing_page")

    except GroupInvitation.DoesNotExist:
        messages.error(request, "Invalid invitation code.")
        return redirect("landing_page")

    # Pre-fill invitation code and email
    initial_data = {
        "invitation_code": invite_code,
        "email": invitation.email,
    }

    if request.method == "POST":
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)  # Automatically log in after joining
            messages.success(request, f"Welcome to {form.invitation.group.name}!")
            return redirect(user.profile.get_home_redirect_url())
    else:
        form = UserRegistrationForm(initial=initial_data)

    return render(request, "bookclub/join.html", {"form": form})
