"""
Book proposal views for member-submitted book proposals
"""

import logging

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from ..forms import BookProposalForm, ReviewProposalForm
from ..hardcover_api import HardcoverAPI
from ..models import Book, BookGroup, BookProposal, User
from ..notifications import send_push_notification

logger = logging.getLogger(__name__)


@login_required
def propose_book(request, group_id, hardcover_id):
    """
    Member view to propose a book to the group
    """
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is a member
    if not group.is_member(request.user):
        messages.error(request, "You must be a member of this group to propose books.")
        return redirect("group_detail", group_id=group.id)

    # Check if feature is enabled
    if not group.is_book_proposals_enabled():
        messages.error(request, "Book proposals are not enabled for this group.")
        return redirect("group_detail", group_id=group.id)

    # Admins should add books directly, not propose them
    if group.is_admin(request.user):
        messages.info(request, "As an admin, you can add books directly.")
        return redirect(
            "add_book_to_group", group_id=group.id, hardcover_id=hardcover_id
        )

    # Fetch book details from Hardcover API
    book_data = HardcoverAPI.get_book_details(hardcover_id, request.user)
    if not book_data:
        messages.error(request, "Could not fetch book details from Hardcover.")
        return redirect("search_books", group_id=group.id)

    # Check if book already exists in the group
    existing_book = Book.objects.filter(group=group, hardcover_id=hardcover_id).first()
    if existing_book:
        messages.warning(request, "This book is already in the group.")
        return redirect("book_detail", book_id=existing_book.id)

    # Check if there's already a pending proposal for this book
    existing_proposal = BookProposal.objects.filter(
        group=group, hardcover_id=hardcover_id, status="pending"
    ).first()
    if existing_proposal:
        messages.warning(
            request,
            f"This book has already been proposed by {existing_proposal.proposed_by.first_name}. "
            "You can view it in the proposals page.",
        )
        return redirect("group_proposals", group_id=group.id)

    if request.method == "POST":
        form = BookProposalForm(request.POST)
        if form.is_valid():
            # Create the proposal
            proposal = BookProposal.objects.create(
                group=group,
                proposed_by=request.user,
                hardcover_id=hardcover_id,
                title=book_data.get("title", ""),
                author=book_data.get("author", {}).get("name", ""),
                cover_image_url=book_data.get("cover_image_url", ""),
                description=book_data.get("description", ""),
                url=book_data.get("url", ""),
                pages=book_data.get("pages"),
                audio_seconds=book_data.get("audio_seconds"),
                proposal_note=form.cleaned_data.get("proposal_note", ""),
                status="pending",
            )

            messages.success(
                request,
                f"Your proposal for '{book_data.get('title')}' has been submitted for admin review.",
            )

            # Notify all admins
            admins = group.admins.all()
            proposal_url = reverse("group_proposals", kwargs={"group_id": group.id})
            for admin in admins:
                send_push_notification(
                    user=admin,
                    title=f"New Book Proposal in {group.name}",
                    body=f"{request.user.first_name} proposed '{book_data.get('title')}'",
                    url=proposal_url,
                    notification_type="new_book_proposal",
                )

            return redirect("group_proposals", group_id=group.id)
    else:
        form = BookProposalForm()

    context = {
        "group": group,
        "book": book_data,
        "form": form,
    }
    return render(request, "bookclub/propose_book.html", context)


@login_required
def group_proposals(request, group_id):
    """
    View all book proposals for a group (pending, approved, rejected)
    """
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is a member
    if not group.is_member(request.user):
        messages.error(request, "You must be a member of this group to view proposals.")
        return redirect("home")

    # Check if feature is enabled
    if not group.is_book_proposals_enabled():
        messages.error(request, "Book proposals are not enabled for this group.")
        return redirect("group_detail", group_id=group.id)

    is_admin = group.is_admin(request.user)

    # Get all proposals for the group, organized by status
    pending_proposals = group.book_proposals.filter(status="pending")
    approved_proposals = group.book_proposals.filter(status="approved")
    rejected_proposals = group.book_proposals.filter(status="rejected")

    context = {
        "group": group,
        "is_admin": is_admin,
        "pending_proposals": pending_proposals,
        "approved_proposals": approved_proposals,
        "rejected_proposals": rejected_proposals,
    }
    return render(request, "bookclub/group_proposals.html", context)


@login_required
def review_proposal(request, proposal_id):
    """
    Admin view to review and approve/reject a proposal
    """
    proposal = get_object_or_404(BookProposal, id=proposal_id)
    group = proposal.group

    # Check if user is an admin
    if not group.is_admin(request.user):
        messages.error(request, "Only group admins can review proposals.")
        return redirect("group_proposals", group_id=group.id)

    # Check if already reviewed
    if proposal.status != "pending":
        messages.warning(request, "This proposal has already been reviewed.")
        return redirect("group_proposals", group_id=group.id)

    if request.method == "POST":
        form = ReviewProposalForm(request.POST, group=group)
        if form.is_valid():
            action = form.cleaned_data.get("action")

            if action == "reject":
                # Reject the proposal
                rejection_reason = form.cleaned_data.get("rejection_reason", "")
                proposal.reject(request.user, rejection_reason)

                messages.success(
                    request, f"Proposal for '{proposal.title}' has been rejected."
                )

                # Notify proposer
                send_push_notification(
                    user=proposal.proposed_by,
                    title=f"Proposal Rejected in {group.name}",
                    body=f"Your proposal for '{proposal.title}' was not accepted.",
                    url=reverse("group_proposals", kwargs={"group_id": group.id}),
                    notification_type="proposal_rejected",
                )

            elif action == "approve":
                # Approve the proposal and create the book
                proposal.approve(request.user)

                # Get picked_by user if specified
                picked_by_id = form.cleaned_data.get("picked_by")
                picked_by = None
                if picked_by_id:
                    try:
                        picked_by = User.objects.get(id=int(picked_by_id))
                    except (User.DoesNotExist, ValueError):
                        pass

                # Create the book in the group
                book = Book.objects.create(
                    group=group,
                    hardcover_id=proposal.hardcover_id,
                    title=proposal.title,
                    author=proposal.author,
                    cover_image_url=proposal.cover_image_url,
                    description=proposal.description,
                    url=proposal.url,
                    pages=proposal.pages,
                    audio_seconds=proposal.audio_seconds,
                    picked_by=picked_by,
                    is_collective_pick=form.cleaned_data.get(
                        "is_collective_pick", False
                    ),
                )

                # Link proposal to created book
                proposal.created_book = book
                proposal.save()

                # Set as active if requested
                if form.cleaned_data.get("set_active"):
                    book.set_active()

                messages.success(
                    request,
                    f"Proposal for '{proposal.title}' has been approved and added to the group!",
                )

                # Notify proposer
                send_push_notification(
                    user=proposal.proposed_by,
                    title=f"Proposal Approved in {group.name}",
                    body=f"Your proposal for '{proposal.title}' was accepted!",
                    url=reverse("book_detail", kwargs={"book_id": book.id}),
                    notification_type="proposal_approved",
                )

            return redirect("group_proposals", group_id=group.id)
    else:
        form = ReviewProposalForm(group=group)

    context = {
        "group": group,
        "proposal": proposal,
        "form": form,
    }
    return render(request, "bookclub/review_proposal.html", context)


@login_required
def delete_proposal(request, proposal_id):
    """
    Delete a proposal (proposer can delete their pending proposals, admins can delete any pending proposal)
    """
    proposal = get_object_or_404(BookProposal, id=proposal_id)
    group = proposal.group

    # Check permissions: proposer can delete their own pending proposals, admins can delete any pending proposal
    is_admin = group.is_admin(request.user)
    is_proposer = proposal.proposed_by == request.user

    if not is_admin and not is_proposer:
        messages.error(request, "You don't have permission to delete this proposal.")
        return redirect("group_proposals", group_id=group.id)

    # Only pending proposals can be deleted
    if proposal.status != "pending":
        messages.error(request, "Only pending proposals can be deleted.")
        return redirect("group_proposals", group_id=group.id)

    if request.method == "POST":
        title = proposal.title
        proposal.delete()
        messages.success(request, f"Proposal for '{title}' has been deleted.")
        return redirect("group_proposals", group_id=group.id)

    context = {
        "group": group,
        "proposal": proposal,
    }
    return render(request, "bookclub/delete_proposal.html", context)
