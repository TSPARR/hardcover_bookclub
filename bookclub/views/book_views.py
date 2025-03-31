"""
Book-related views for managing books, reading progress, etc.
"""

import json
import logging

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from ..forms import BookSearchForm, CommentForm
from ..hardcover_api import HardcoverAPI
from ..kavita_api import update_kavita_info_for_book
from ..models import (
    Book,
    BookEdition,
    BookGroup,
    Comment,
    CommentReaction,
    User,
    UserBookProgress,
)
from .book_utils import (
    convert_progress_to_pages,
    convert_progress_to_seconds,
    create_or_update_book_edition,
    link_progress_to_edition,
    parse_audio_progress,
    process_hardcover_edition_data,
    process_progress_from_request,
    sync_progress_to_hardcover,
)
from .comment_utils import (
    add_normalized_progress_to_comments,
    handle_comment_reaction,
    handle_reply_to_comment,
    sort_comments,
)

logger = logging.getLogger(__name__)


@login_required
def book_detail(request, book_id):
    book = get_object_or_404(Book, id=book_id)

    if settings.KAVITA_ENABLED and not book.kavita_url:
        update_kavita_info_for_book(book)

    # Get or create user progress for this book
    user_progress, created = UserBookProgress.objects.get_or_create(
        user=request.user,
        book=book,
        defaults={
            "progress_type": "percent",
            "progress_value": "0",
            "normalized_progress": 0,
        },
    )

    # Get sorting option from request
    sort_by = request.GET.get("sort", "date_desc")

    # Get all comments for this book - but only top-level comments (not replies)
    comments = book.comments.filter(parent=None)

    # Sort the comments based on the selected option
    comments = sort_comments(comments, sort_by)

    # Add normalized progress for spoiler detection
    comments = add_normalized_progress_to_comments(comments)

    if request.method == "POST":
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.user = request.user
            comment.book = book

            # Handle reply
            parent_id = request.POST.get("parent_id")
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

            # Get Hardcover progress data from hidden fields if available
            if request.POST.get("hardcover_data"):
                try:
                    hardcover_data = json.loads(request.POST.get("hardcover_data"))
                    process_hardcover_edition_data(
                        book, comment, hardcover_data, user_progress, request.user
                    )
                except json.JSONDecodeError as e:
                    logger.error(f"Error parsing Hardcover data: {e}")
            else:
                # Update user progress based on the comment's progress
                user_progress.progress_type = comment.progress_type
                user_progress.progress_value = comment.progress_value
                user_progress.save()

            comment.save()

            # If this is a reply, redirect to the parent comment
            if comment.parent:
                return redirect(
                    f"{reverse('book_detail', args=[book.id])}#comment-{comment.parent.id}"
                )
            return redirect("book_detail", book_id=book.id)
    else:
        form = CommentForm()

    # Add reaction choices to the context
    reaction_choices = CommentReaction.REACTION_CHOICES

    return render(
        request,
        "bookclub/book_detail.html",
        {
            "book": book,
            "comments": comments,
            "form": form,
            "current_sort": sort_by,
            "user_progress": user_progress,
            "reaction_choices": reaction_choices,
        },
    )


@login_required
def update_book_progress(request, book_id):
    """API endpoint to update a user's reading progress for a book"""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    book = get_object_or_404(Book, id=book_id)

    try:
        # Get or create user progress for this book
        user_progress, created = UserBookProgress.objects.get_or_create(
            user=request.user,
            book=book,
            defaults={
                "progress_type": "percent",
                "progress_value": "0",
                "normalized_progress": 0,
            },
        )

        data = json.loads(request.body)
        reload_page = False

        # Process data and update user_progress
        user_progress = process_progress_from_request(data, user_progress)

        # Handle edition linking if edition_id is available
        if "hardcover_data" in data and data["hardcover_data"].get("edition_id"):
            reload_page = link_progress_to_edition(
                user_progress, data["hardcover_data"]["edition_id"], book, request.user
            )

        # Update book metadata if available and not already saved
        if "hardcover_data" in data:
            hardcover_data = data["hardcover_data"]
            if hardcover_data.get("edition_pages") and not book.pages:
                book.pages = hardcover_data.get("edition_pages")
                book.save(update_fields=["pages"])

            if hardcover_data.get("edition_audio_seconds") and not book.audio_seconds:
                book.audio_seconds = hardcover_data.get("edition_audio_seconds")
                book.save(update_fields=["audio_seconds"])

        # Save the updated progress
        user_progress.save()

        return JsonResponse(
            {
                "success": True,
                "progress": {
                    "progress_type": user_progress.progress_type,
                    "progress_value": user_progress.progress_value,
                    "normalized_progress": user_progress.normalized_progress,
                    "last_updated": user_progress.last_updated.strftime("%Y-%m-%d"),
                },
                # Include reload flag for auto-sync to know when to refresh page
                "reload": reload_page,
            }
        )

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON data"}, status=400)
    except Exception as e:
        logger.exception(f"Error updating book progress: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)


@login_required
def search_books(request, group_id):
    group = get_object_or_404(BookGroup, id=group_id)
    search_results = []

    if request.method == "POST":
        form = BookSearchForm(request.POST)
        if form.is_valid():
            query = form.cleaned_data["query"]
            logger.debug(f"Processing search request for query: '{query}'")

            # Try the search
            try:
                search_results = HardcoverAPI.search_books(query, user=request.user)
                if not search_results:
                    logger.debug("Search returned no results")
            except Exception as e:
                logger.exception(f"Error during book search: {str(e)}")
                messages.error(request, "An error occurred while searching for books.")
    else:
        form = BookSearchForm()

    return render(
        request,
        "bookclub/search_books.html",
        {
            "form": form,
            "results": search_results,
            "group": group,
        },
    )


@login_required
def add_book_to_group(request, group_id, hardcover_id):
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is a member of this group
    if not group.is_admin(request.user):
        messages.error(request, "You don't have permission to add books to this group.")
        return redirect("group_detail", group_id=group.id)

    # Get book details from Hardcover API
    book_data = HardcoverAPI.get_book_details(hardcover_id, user=request.user)

    if not book_data:
        messages.error(request, "Could not retrieve book details from Hardcover.")
        return redirect("search_books", group_id=group.id)

    if request.method == "POST":
        # Process attribution data if provided
        picked_by_id = request.POST.get("picked_by")
        is_collective_pick = request.POST.get("is_collective_pick") == "on"

        # Determine the next display order
        next_order = Book.objects.filter(group=group).count()

        # Create or update book in database
        book, created = Book.objects.get_or_create(
            hardcover_id=hardcover_id,
            defaults={
                "title": book_data.get("title", "Unknown Title"),
                "author": (
                    book_data["author"]["name"]
                    if book_data.get("author")
                    else "Unknown Author"
                ),
                "cover_image_url": book_data.get("cover_image_url", ""),
                "url": book_data.get("url", ""),
                "description": book_data.get("description", ""),
                "group": group,
                "display_order": next_order,
                "is_collective_pick": is_collective_pick,
            },
        )

        if not created:
            # If book already exists, associate it with this group
            book.group = group
            if not book.url and book_data.get("url"):
                book.url = book_data.get("url")
            book.display_order = next_order
            book.is_collective_pick = is_collective_pick
            book.save()

        # Set picked_by if provided and not a collective pick
        if picked_by_id and not is_collective_pick:
            picked_by_user = get_object_or_404(User, id=picked_by_id)
            book.picked_by = picked_by_user
            book.save()

        # Set as active book if requested
        set_active = request.POST.get("set_active") == "on"
        if set_active:
            book.set_active()

        messages.success(request, f"'{book.title}' has been added to the group.")
        return redirect("group_detail", group_id=group.id)

    # For GET requests, show confirmation form with attribution options
    members = group.members.all()

    return render(
        request,
        "bookclub/confirm_add_book.html",
        {
            "group": group,
            "book_data": book_data,
            "members": members,
            "hardcover_id": hardcover_id,
        },
    )


@login_required
def get_book_editions(request, hardcover_id):
    """API endpoint to get all editions of a book from Hardcover"""
    try:
        editions = HardcoverAPI.get_book_editions(hardcover_id, user=request.user)
        return JsonResponse({"editions": editions})
    except Exception as e:
        logger.exception(f"Error fetching Hardcover editions: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)


@login_required
def select_edition(request, book_id):
    """Allow users to select a specific edition for a book"""
    book = get_object_or_404(Book, id=book_id)

    # Get current user progress for this book
    user_progress, created = UserBookProgress.objects.get_or_create(
        user=request.user,
        book=book,
        defaults={
            "progress_type": "percent",
            "progress_value": "0",
            "normalized_progress": 0,
        },
    )

    # Try to get editions from Hardcover
    editions = HardcoverAPI.get_book_editions(book.hardcover_id, user=request.user)

    if request.method == "POST":
        edition_id = request.POST.get("edition_id")

        if edition_id == "none":
            # User wants to clear edition selection
            user_progress.edition = None
            user_progress.save()
            messages.success(request, "Edition selection cleared.")
            return redirect("book_detail", book_id=book.id)

        # Find and create/update the edition in our database
        for edition_data in editions:
            if str(edition_data["id"]) == edition_id:
                # Create or update the edition using our utility function
                edition = create_or_update_book_edition(book, edition_data)

                # Update user progress to use this edition
                user_progress.edition = edition
                user_progress.save()

                messages.success(request, f"Selected edition: {edition.title}")
                return redirect("book_detail", book_id=book.id)

        messages.error(request, "Selected edition not found.")

    # Determine current selected edition
    current_edition = user_progress.edition

    return render(
        request,
        "bookclub/select_edition.html",
        {
            "book": book,
            "editions": editions,
            "current_edition": current_edition,
        },
    )


@login_required
def set_manual_progress(request, book_id):
    """Set manual progress for a book edition"""
    book = get_object_or_404(Book, id=book_id)

    # Get current user progress for this book
    user_progress, created = UserBookProgress.objects.get_or_create(
        user=request.user,
        book=book,
        defaults={
            "progress_type": "percent",
            "progress_value": "0",
            "normalized_progress": 0,
        },
    )

    # Get or fetch hardcover reading progress if available
    hardcover_progress = None
    hardcover_read_id = user_progress.hardcover_read_id

    if not hardcover_read_id and request.user.profile.hardcover_api_key:
        # Try to fetch from Hardcover API if we don't have an ID yet
        try:
            progress_data = HardcoverAPI.get_reading_progress(
                book.hardcover_id, user=request.user
            )
            if (
                progress_data
                and "progress" in progress_data
                and progress_data["progress"]
            ):
                # Found progress on Hardcover, save the read ID for future updates
                hardcover_progress = progress_data["progress"][0]
                hardcover_read_id = hardcover_progress.get("read_id")
                if hardcover_read_id:
                    user_progress.hardcover_read_id = hardcover_read_id
                    user_progress.save(update_fields=["hardcover_read_id"])
        except Exception as e:
            logger.exception(f"Error fetching Hardcover progress: {str(e)}")

    if request.method == "POST":
        progress_type = request.POST.get("progress_type")
        progress_value = request.POST.get("progress_value")
        started_reading = request.POST.get("started_reading") == "on"
        finished_reading = request.POST.get("finished_reading") == "on"
        sync_to_hardcover = request.POST.get("sync_to_hardcover") == "on"

        # Update progress type and value
        user_progress.progress_type = progress_type
        user_progress.progress_value = progress_value

        if started_reading and not user_progress.hardcover_started_at:
            user_progress.hardcover_started_at = timezone.now()

        if finished_reading and not user_progress.hardcover_finished_at:
            user_progress.hardcover_finished_at = timezone.now()
            # If book is finished, set progress to 100%
            if progress_type == "percent":
                user_progress.progress_value = "100"
            elif (
                progress_type == "page"
                and user_progress.edition
                and user_progress.edition.pages
            ):
                user_progress.progress_value = str(user_progress.edition.pages)
            elif progress_type == "page" and book.pages:
                user_progress.progress_value = str(book.pages)

        # Update normalized progress
        user_progress.save()

        # Push to Hardcover if requested and API key exists
        if sync_to_hardcover and request.user.profile.hardcover_api_key:
            # Calculate pages or seconds based on progress type
            pages = None
            seconds = None

            if user_progress.progress_type == "page" and user_progress.progress_value:
                try:
                    pages = int(user_progress.progress_value)
                except (ValueError, TypeError):
                    pass
            elif (
                user_progress.progress_type == "audio" and user_progress.progress_value
            ):
                seconds = parse_audio_progress(user_progress.progress_value)
            elif (
                user_progress.progress_type == "percent"
                and user_progress.normalized_progress
            ):
                # For percentage, convert to pages or seconds based on edition format
                progress_percent = user_progress.normalized_progress
                if user_progress.edition:
                    if (
                        user_progress.edition.reading_format_id == 2
                        and user_progress.edition.audio_seconds
                    ):
                        # Audio format
                        seconds = convert_progress_to_seconds(
                            progress_percent, edition=user_progress.edition
                        )
                    elif (
                        user_progress.edition.reading_format_id in [1, 4]
                        and user_progress.edition.pages
                    ):
                        # Physical book or ebook
                        pages = convert_progress_to_pages(
                            progress_percent, edition=user_progress.edition
                        )

            # Sync to Hardcover
            sync_result = sync_progress_to_hardcover(
                request.user, book, user_progress, pages=pages, seconds=seconds
            )

            # Handle sync result
            if sync_result and isinstance(sync_result, dict):
                if "error" not in sync_result:
                    messages.success(
                        request, "Progress was updated and synced to Hardcover."
                    )
                else:
                    messages.warning(
                        request,
                        f"Local progress updated but Hardcover sync failed: {sync_result['error']}",
                    )
            else:
                messages.warning(
                    request, "Local progress updated but Hardcover sync failed."
                )
        else:
            messages.success(request, "Reading progress updated successfully.")

        return redirect("book_detail", book_id=book.id)

    return render(
        request,
        "bookclub/set_manual_progress.html",
        {
            "book": book,
            "user_progress": user_progress,
            "has_hardcover_key": bool(request.user.profile.hardcover_api_key),
            "hardcover_read_id": hardcover_read_id,
        },
    )


@login_required
def remove_book(request, group_id, book_id):
    group = get_object_or_404(BookGroup, id=group_id)
    book = get_object_or_404(Book, id=book_id)

    # Check if user is an admin of this group
    if not group.is_admin(request.user):
        messages.error(
            request, "You don't have permission to remove books from this group."
        )
        return redirect("group_detail", group_id=group.id)

    # Check if the book belongs to this group
    if book.group.id != group.id:
        messages.error(request, "This book does not belong to this group.")
        return redirect("group_detail", group_id=group.id)

    # Remove the book
    book.delete()
    messages.success(request, f"'{book.title}' has been removed from the group.")

    return redirect("group_detail", group_id=group.id)


@login_required
def toggle_book_active(request, group_id, book_id):
    """Toggle the active status of a book in a group"""
    group = get_object_or_404(BookGroup, id=group_id)
    book = get_object_or_404(Book, id=book_id, group=group)

    # Check if user is a member of this group
    if not group.is_member(request.user):
        messages.error(request, "You are not a member of this group.")
        return redirect("home")

    # Check if this is a POST request (for security)
    if request.method != "POST":
        return redirect("group_detail", group_id=group.id)

    # If the book is already active, we're deactivating it
    if book.is_active:
        book.is_active = False
        book.save(update_fields=["is_active"])
        messages.success(request, f"'{book.title}' is no longer the active book.")
    else:
        # Use the method we defined to set as active (deactivates others)
        book.set_active()
        messages.success(request, f"'{book.title}' is now set as the active book.")

    return redirect("group_detail", group_id=group.id)


@login_required
def edit_comment(request, comment_id):
    """Edit an existing comment"""
    comment = get_object_or_404(Comment, id=comment_id)
    book = comment.book

    # Ensure user can only edit their own comments
    if comment.user != request.user:
        messages.error(request, "You can only edit your own comments.")
        return redirect("book_detail", book_id=book.id)

    if request.method == "POST":
        form = CommentForm(request.POST, instance=comment)
        if form.is_valid():
            # Update comment text
            comment = form.save(commit=False)

            # Update progress if provided
            if request.POST.get("progress_type") and request.POST.get("progress_value"):
                comment.progress_type = request.POST.get("progress_type")
                comment.progress_value = request.POST.get("progress_value")

            comment.save()
            messages.success(request, "Your comment has been updated.")
            return redirect("book_detail", book_id=book.id)
    else:
        form = CommentForm(instance=comment)

    return render(
        request,
        "bookclub/edit_comment.html",
        {
            "form": form,
            "comment": comment,
            "book": book,
        },
    )


@login_required
def delete_comment(request, comment_id):
    """Delete a comment"""
    comment = get_object_or_404(Comment, id=comment_id)
    book = comment.book

    # Ensure user can only delete their own comments
    if comment.user != request.user:
        messages.error(request, "You can only delete your own comments.")
        return redirect("book_detail", book_id=book.id)

    if request.method == "POST":
        comment.delete()
        messages.success(request, "Your comment has been deleted.")
        return redirect("book_detail", book_id=book.id)

    return render(
        request,
        "bookclub/delete_comment.html",
        {
            "comment": comment,
            "book": book,
        },
    )


@login_required
def toggle_reaction(request, comment_id):
    """Toggle a reaction on a comment"""
    return handle_comment_reaction(request, comment_id)


@login_required
def reply_to_comment(request, comment_id):
    """Handle replying to a comment"""
    return handle_reply_to_comment(request, comment_id)
