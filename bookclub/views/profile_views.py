"""
User profile related views
"""

import logging
import requests
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from ..forms import ApiKeyForm
from ..hardcover_api import HardcoverAPI

logger = logging.getLogger(__name__)


@login_required
def profile_settings(request):
    if request.method == "POST":
        form = ApiKeyForm(request.POST, instance=request.user.profile)
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
                            request, "Your API key has been updated successfully."
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
                messages.success(request, "Your API key has been removed.")

            return redirect("profile_settings")
    else:
        form = ApiKeyForm(instance=request.user.profile)

    return render(request, "bookclub/profile_settings.html", {"form": form})
