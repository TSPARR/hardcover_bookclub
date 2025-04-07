"""
Comment and reaction-related utility functions.
"""

import json
import logging

from django.contrib import messages
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse

from ..models import Comment, CommentReaction
from .book_utils import _get_progress_value_for_sorting

logger = logging.getLogger(__name__)


def add_normalized_progress_to_comments(comments):
    """Add normalized progress values to comments and their replies for spoiler detection."""
    for comment in comments:
        comment.normalized_progress = _get_progress_value_for_sorting(comment)
        # For each comment, get its replies and add normalized progress to them too
        for reply in comment.get_replies():
            reply.normalized_progress = _get_progress_value_for_sorting(reply)
    return comments


def sort_comments(comments, sort_by):
    """Sort comments based on the selected option."""
    if sort_by == "date_asc":
        return comments.order_by("created_at")
    elif sort_by == "date_desc":
        return comments.order_by("-created_at")
    elif sort_by == "progress_asc":
        # For progress sorting, we need custom logic
        # First, try to sort by normalized_progress if available
        if hasattr(comments.first(), "normalized_progress"):
            comments_list = list(comments.all())
            comments_list.sort(key=lambda c: c.normalized_progress, reverse=False)
            return comments_list
        # Otherwise, try Hardcover percent if available
        elif comments.filter(hardcover_percent__isnull=False).exists():
            return comments.order_by("hardcover_percent", "-created_at")
        else:
            # Fallback to sorting by progress_type and value
            # This is more complex since progress_value can be different formats
            # We'll get all comments and sort in Python
            comments_list = list(comments.all())
            comments_list.sort(
                key=lambda c: _get_progress_value_for_sorting(c), reverse=False
            )
            return comments_list
    elif sort_by == "progress_desc":
        # Similar to progress_asc but in reverse
        if hasattr(comments.first(), "normalized_progress"):
            comments_list = list(comments.all())
            comments_list.sort(key=lambda c: c.normalized_progress, reverse=True)
            return comments_list
        elif comments.filter(hardcover_percent__isnull=False).exists():
            return comments.order_by("-hardcover_percent", "-created_at")
        else:
            comments_list = list(comments.all())
            comments_list.sort(
                key=lambda c: _get_progress_value_for_sorting(c), reverse=True
            )
            return comments_list
    else:
        # Default to date descending
        return comments.order_by("-created_at")


def handle_comment_reaction(request, comment_id):
    """Handle adding or removing a reaction to a comment."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        reaction_type = data.get("reaction")

        if not reaction_type:
            return JsonResponse({"error": "Reaction type is required"}, status=400)

        comment = get_object_or_404(Comment, id=comment_id)

        # Check if the user already has this reaction on the comment
        existing_reaction = CommentReaction.objects.filter(
            comment=comment, user=request.user, reaction=reaction_type
        ).first()

        if existing_reaction:
            # Remove the reaction if it exists
            existing_reaction.delete()
            action = "removed"
        else:
            # Add the reaction
            CommentReaction.objects.create(
                comment=comment, user=request.user, reaction=reaction_type
            )
            action = "added"

        # Get updated reaction information
        reactions_data = {}

        # Get all reactions for this comment with user information
        for reaction in CommentReaction.REACTION_CHOICES:
            reaction_code = reaction[0]

            # Get users who reacted with this reaction
            user_reactions = CommentReaction.objects.filter(
                comment=comment, reaction=reaction_code
            ).select_related("user")

            # Only include in response if there are reactions of this type
            if user_reactions.exists():
                reactions_data[reaction_code] = {
                    "count": user_reactions.count(),
                    "users": [r.user.username for r in user_reactions],
                    "current_user_reacted": any(
                        r.user.id == request.user.id for r in user_reactions
                    ),
                }

        return JsonResponse(
            {
                "success": True,
                "action": action,
                "reaction": reaction_type,
                "reactions": reactions_data,
                # Keep the old counts format for backward compatibility
                "counts": {k: v["count"] for k, v in reactions_data.items()},
            }
        )

    except Exception as e:
        logger.exception(f"Error toggling reaction: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)


def create_comment_for_book(request, book, form, parent_id=None):
    """Create a new comment or reply for a book."""
    if not form.is_valid():
        return None, False

    comment = form.save(commit=False)
    comment.user = request.user
    comment.book = book

    # Handle reply
    if parent_id:
        parent_comment = get_object_or_404(Comment, id=parent_id)
        comment.parent = parent_comment

        # Optionally inherit progress from parent comment
        if not request.POST.get("progress_type") or not request.POST.get(
            "progress_value"
        ):
            comment.progress_type = parent_comment.progress_type
            comment.progress_value = parent_comment.progress_value

    # Get progress data from form
    if request.POST.get("progress_type") and request.POST.get("progress_value"):
        comment.progress_type = request.POST.get("progress_type")
        comment.progress_value = request.POST.get("progress_value")

    # Calculate and set normalized progress
    comment.normalized_progress = _get_progress_value_for_sorting(comment)

    comment.save()
    return comment, True


def handle_reply_to_comment(request, comment_id):
    """Handle reply creation for a comment."""
    logger.debug(f"=== REPLY TO COMMENT VIEW STARTED for comment_id={comment_id} ===")
    logger.debug(f"User: {request.user.username}, Method: {request.method}")

    try:
        parent_comment = get_object_or_404(Comment, id=comment_id)
        logger.debug(
            f"Parent comment found: id={parent_comment.id}, text={parent_comment.text[:30]}..."
        )

        book = parent_comment.book
        logger.debug(f"Book: id={book.id}, title={book.title}")

        if request.method == "POST":
            logger.debug(f"POST data received: {dict(request.POST)}")

            from ..forms import CommentForm

            form = CommentForm(request.POST)
            logger.debug(f"Form initialized with POST data")

            if form.is_valid():
                logger.debug("Form is valid, creating reply")
                # Log form cleaned data
                logger.debug(f"Form cleaned data: {form.cleaned_data}")

                try:
                    reply = form.save(commit=False)
                    logger.debug("Form saved with commit=False")

                    reply.user = request.user
                    reply.book = book
                    reply.parent = parent_comment

                    # Copy progress fields from parent comment
                    reply.progress_type = parent_comment.progress_type
                    reply.progress_value = parent_comment.progress_value

                    # Calculate and set normalized progress
                    reply.normalized_progress = _get_progress_value_for_sorting(reply)

                    logger.debug(
                        f"About to save reply with: user={reply.user.id}, book={reply.book.id}, parent={reply.parent.id}"
                    )
                    reply.save()
                    logger.debug(f"Reply saved successfully with ID: {reply.id}")

                    messages.success(request, "Your reply has been posted.")
                    redirect_url = f"{reverse('book_detail', args=[book.id])}?tab=discussion#comment-{parent_comment.id}"
                    logger.debug(f"Redirecting to: {redirect_url}")
                    return redirect(redirect_url)
                except Exception as e:
                    logger.error(f"Error saving reply: {str(e)}", exc_info=True)
                    messages.error(request, f"Error saving your reply: {str(e)}")
            else:
                logger.warning(f"Form validation failed. Errors: {form.errors}")
                messages.error(request, "Please correct the errors in your form.")
        else:
            from ..forms import CommentForm

            logger.debug("GET request, initializing empty form")
            form = CommentForm()

        logger.debug("Rendering reply_to_comment.html template")
        return render(
            request,
            "bookclub/reply_to_comment.html",
            {
                "form": form,
                "parent_comment": parent_comment,
                "book": book,
            },
        )
    except Exception as e:
        logger.error(
            f"Unexpected error in reply_to_comment view: {str(e)}", exc_info=True
        )
        messages.error(request, f"An unexpected error occurred: {str(e)}")
        return redirect("home")


def get_comment_reaction_users(request, comment_id):
    """API endpoint to get users who reacted to a comment."""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        comment = get_object_or_404(Comment, id=comment_id)

        # Get all reactions for this comment with user information
        reactions_data = {}

        # Get user reactions
        all_reactions = CommentReaction.objects.filter(comment=comment).select_related(
            "user"
        )

        # Group reactions by type
        for reaction in CommentReaction.REACTION_CHOICES:
            reaction_code = reaction[0]

            # Get users who reacted with this reaction
            user_reactions = all_reactions.filter(reaction=reaction_code)

            # Only include if there are reactions of this type
            if user_reactions.exists():
                reactions_data[reaction_code] = {
                    "count": user_reactions.count(),
                    "users": [r.user.username for r in user_reactions],
                    "current_user_reacted": any(
                        r.user.id == request.user.id for r in user_reactions
                    ),
                }

        return JsonResponse({"success": True, "reactions": reactions_data})

    except Exception as e:
        logger.exception(f"Error getting reaction users: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)
