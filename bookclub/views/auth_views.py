"""
Authentication-related views like login, registration, etc.
"""

import logging
from django.contrib.auth import login
from django.shortcuts import redirect, render

from ..forms import UserRegistrationForm

logger = logging.getLogger(__name__)


def landing_page(request):
    # If user is already logged in, redirect to home
    if request.user.is_authenticated:
        return redirect("home")
    return render(request, "bookclub/landing.html")


def register(request):
    if request.method == "POST":
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)  # Automatically log in after registration
            return redirect("home")
    else:
        form = UserRegistrationForm()
    return render(request, "bookclub/register.html", {"form": form})
