"""
Authentication-related views like login, registration with invitation, etc.
"""

import logging

from django.contrib import messages
from django.contrib.auth import login
from django.shortcuts import redirect, render

from ..forms import UserRegistrationForm
from ..models import GroupInvitation

logger = logging.getLogger(__name__)


def landing_page(request):
    # If user is already logged in, redirect to home
    if request.user.is_authenticated:
        return redirect("home")
    return render(request, "bookclub/landing.html")


def register_with_invite(request, invite_code=None):
    """Handle registration with an invitation code"""

    # If user is already logged in, redirect to home
    if request.user.is_authenticated:
        return redirect("home")

    initial_data = {}

    # If invitation code is provided in URL, pre-fill form
    if invite_code:
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

            # Pre-fill invitation code and email if available
            initial_data = {
                "invitation_code": invite_code,
                "email": invitation.email,
            }

        except GroupInvitation.DoesNotExist:
            messages.error(request, "Invalid invitation code.")
            return redirect("landing_page")

    if request.method == "POST":
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)  # Automatically log in after registration
            messages.success(request, f"Welcome to {form.invitation.group.name}!")
            return redirect("home")
    else:
        form = UserRegistrationForm(initial=initial_data)

    return render(request, "bookclub/register.html", {"form": form})


def register(request):
    """
    Legacy registration function now redirects to landing page
    """
    messages.info(request, "Registration requires an invitation link.")
    return redirect("landing_page")
