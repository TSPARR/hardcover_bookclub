"""
Views for managing group invitations
"""

import logging
from datetime import timedelta

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.html import escape

from ..models import BookGroup, GroupInvitation

logger = logging.getLogger(__name__)


@login_required
def manage_invitations(request, group_id):
    """View for managing group invitations"""
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is an admin of this group
    if not group.is_admin(request.user):
        messages.error(
            request, "You don't have permission to manage invitations for this group."
        )
        return redirect("group_detail", group_id=group.id)

    # Get all invitations for this group
    invitations = GroupInvitation.objects.filter(group=group)

    # Build breadcrumbs
    breadcrumb_items = [
        {"url": reverse("home"), "title": "Home"},
        {
            "url": reverse("group_detail", kwargs={"group_id": group.id}),
            "title": group.name,
        },
        {"url": "", "title": "Manage Invitations"},
    ]

    # Check for newly created invitation in session
    new_invitation_link = request.session.pop("new_invitation_link", None)
    new_invitation_code = request.session.pop("new_invitation_code", None)

    return render(
        request,
        "bookclub/manage_invitations.html",
        {
            "group": group,
            "invitations": invitations,
            "breadcrumb_items": breadcrumb_items,
            "now": timezone.now(),
            "new_invitation_link": new_invitation_link,
            "new_invitation_code": new_invitation_code,
        },
    )


@login_required
def create_invitation(request, group_id):
    """Create a new invitation for a group"""
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is an admin of this group
    if not group.is_admin(request.user):
        messages.error(
            request, "You don't have permission to create invitations for this group."
        )
        return redirect("group_detail", group_id=group.id)

    if request.method == "POST":
        # Get expiration days (default to 7 if not provided or invalid)
        try:
            expiry_days = int(request.POST.get("expiry_days", 7))
            expiry_days = max(1, min(expiry_days, 30))  # Limit between 1 and 30 days
        except (ValueError, TypeError):
            expiry_days = 7

        # Get optional email
        email = request.POST.get("email", "").strip() or None

        # Create invitation
        invitation = GroupInvitation.objects.create(
            group=group,
            created_by=request.user,
            expires_at=timezone.now() + timedelta(days=expiry_days),
            email=email,
        )

        # Generate invite URL
        invite_url = request.build_absolute_uri(
            reverse("register_with_invite", kwargs={"invite_code": invitation.code})
        )

        # Store the invitation link in the session for display on the next page
        request.session["new_invitation_link"] = invite_url
        request.session["new_invitation_code"] = invitation.code

        messages.success(
            request,
            "Invitation created successfully! Copy the link below to share it.",
        )
        return redirect("manage_invitations", group_id=group.id)

    # Build breadcrumbs
    breadcrumb_items = [
        {"url": reverse("home"), "title": "Home"},
        {
            "url": reverse("group_detail", kwargs={"group_id": group.id}),
            "title": group.name,
        },
        {
            "url": reverse("manage_invitations", kwargs={"group_id": group.id}),
            "title": "Manage Invitations",
        },
        {"url": "", "title": "Create Invitation"},
    ]

    return render(
        request,
        "bookclub/create_invitation.html",
        {
            "group": group,
            "breadcrumb_items": breadcrumb_items,
        },
    )


@login_required
def revoke_invitation(request, group_id, invitation_id):
    """Revoke a group invitation"""
    group = get_object_or_404(BookGroup, id=group_id)
    invitation = get_object_or_404(GroupInvitation, id=invitation_id, group=group)

    # Check if user is an admin of this group
    if not group.is_admin(request.user):
        messages.error(
            request, "You don't have permission to revoke invitations for this group."
        )
        return redirect("group_detail", group_id=group.id)

    if request.method == "POST":
        invitation.is_revoked = True
        invitation.save()
        messages.success(request, "Invitation has been revoked.")

    return redirect("manage_invitations", group_id=group.id)
