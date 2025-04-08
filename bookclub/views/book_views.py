"""
Book-related views for managing books, reading progress, etc.
"""

import json
import logging
from decimal import Decimal

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

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
from ..notifications import send_push_notification
from ..plex_api import update_plex_info_for_book
from ..utils.storage import is_auto_sync_enabled
from .book_utils import (
    _get_progress_value_for_sorting,
    convert_progress_to_pages,
    convert_progress_to_seconds,
    create_or_update_book_edition,
    get_redirect_url_with_params,
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
from .progress_validator import ProgressValidator

logger = logging.getLogger(__name__)


@login_required
def book_detail(request, book_id):
    book = get_object_or_404(Book, id=book_id)
    group = book.group

    if settings.KAVITA_ENABLED and not book.kavita_url:
        update_kavita_info_for_book(book)

    if settings.PLEX_ENABLED and not book.plex_url:
        update_plex_info_for_book(book)

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

    # Get promoted editions
    kavita_promoted_edition = None
    plex_promoted_edition = None

    if book.kavita_url:
        kavita_promoted_edition = BookEdition.objects.filter(
            book=book, is_kavita_promoted=True
        ).first()

    if book.plex_url:
        plex_promoted_edition = BookEdition.objects.filter(
            book=book, is_plex_promoted=True
        ).first()

    # Add reaction choices to the context - MOVED THIS UP to avoid UnboundLocalError
    reaction_choices = CommentReaction.REACTION_CHOICES

    # Add book and edition metadata for client-side validation
    book_pages = book.pages if book and book.pages else None
    book_audio_seconds = book.audio_seconds if book and book.audio_seconds else None
    edition_pages = None
    edition_audio_seconds = None

    if user_progress and user_progress.edition:
        edition_pages = user_progress.edition.pages
        edition_audio_seconds = user_progress.edition.audio_seconds

    if request.method == "POST":
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.user = request.user
            comment.book = book

            if user_progress and user_progress.edition:
                comment.hardcover_edition_id = (
                    user_progress.edition.hardcover_edition_id
                )

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

            # Get progress data from form and validate
            if request.POST.get("progress_type") and request.POST.get("progress_value"):
                progress_type = request.POST.get("progress_type")
                progress_value = request.POST.get("progress_value")

                # Get book data for validation
                book_data = {"book": book, "edition": user_progress.edition}

                # Validate progress value
                is_valid, result, seconds = ProgressValidator.validate(
                    progress_type, progress_value, book_data
                )

                if not is_valid:
                    error_message = f"Progress validation error: {result}"
                    messages.error(request, error_message)
                    # Add extra information to help the user
                    if "pages" in result:
                        if user_progress.edition and user_progress.edition.pages:
                            messages.info(
                                request,
                                f"This edition has {user_progress.edition.pages} pages.",
                            )
                        elif book.pages:
                            messages.info(request, f"This book has {book.pages} pages.")
                    elif "timestamp" in result:
                        if (
                            user_progress.edition
                            and user_progress.edition.audio_duration_formatted
                        ):
                            messages.info(
                                request,
                                f"This edition's duration is {user_progress.edition.audio_duration_formatted}.",
                            )
                        elif book.audio_seconds:
                            hours = book.audio_seconds // 3600
                            minutes = (book.audio_seconds % 3600) // 60
                            messages.info(
                                request,
                                f"This book's audio duration is approximately {hours}h {minutes}m.",
                            )

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
                            "kavita_promoted_edition": kavita_promoted_edition,
                            "plex_promoted_edition": plex_promoted_edition,
                            "is_admin": group.is_admin(request.user),
                            "book_pages": book_pages,
                            "book_audio_seconds": book_audio_seconds,
                            "edition_pages": edition_pages,
                            "edition_audio_seconds": edition_audio_seconds,
                        },
                    )

                # Set validated progress
                comment.progress_type = progress_type
                comment.progress_value = ProgressValidator.format_progress_value(
                    progress_type, result
                )

                # If it's audio progress and we have seconds, update Hardcover position
                if progress_type == "audio" and seconds is not None:
                    comment.hardcover_current_position = seconds

                # Calculate and set normalized progress
                comment.normalized_progress = _get_progress_value_for_sorting(comment)

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
                    comment_progress_value = _get_progress_value_for_sorting(comment)
                    current_progress_value = _get_progress_value_for_sorting(
                        user_progress
                    )

                    if comment_progress_value > current_progress_value:
                        # Only update if the comment represents progress further in the book
                        user_progress.progress_type = comment.progress_type
                        user_progress.progress_value = comment.progress_value
                        user_progress.normalized_progress = comment.normalized_progress
                        user_progress.save()

                comment.save()

            # If this is a reply, redirect to the parent comment
            if comment.parent:
                return redirect(
                    get_redirect_url_with_params(
                        request,
                        "book_detail",
                        {"book_id": book.id},
                        f"comment-{comment.parent.id}",
                    )
                )

            # For regular comments, preserve tab and sort
            return redirect(
                get_redirect_url_with_params(
                    request,
                    "book_detail",
                    {"book_id": book.id},
                    f"comment-{comment.id}",
                )
            )
    else:
        form = CommentForm()

    auto_sync_enabled = is_auto_sync_enabled(request, book_id)

    user_progress_dict = {
        progress.user.id: progress
        for progress in book.user_progress.select_related("user").all()
    }

    has_dollar_bets_enabled = (
        hasattr(group, "is_dollar_bets_enabled") and group.is_dollar_bets_enabled
    )

    # Prepare the context with all required data
    context = {
        "book": book,
        "comments": comments,
        "form": form,
        "current_sort": sort_by,
        "user_progress": user_progress,
        "user_progress_dict": user_progress_dict,
        "reaction_choices": reaction_choices,
        "kavita_promoted_edition": kavita_promoted_edition,
        "plex_promoted_edition": plex_promoted_edition,
        "is_admin": group.is_admin(request.user),
        "book_pages": book_pages,
        "book_audio_seconds": book_audio_seconds,
        "edition_pages": edition_pages,
        "edition_audio_seconds": edition_audio_seconds,
        "autoSyncEnabled": auto_sync_enabled,
        "has_dollar_bets_enabled": has_dollar_bets_enabled,
    }

    return render(request, "bookclub/book_detail.html", context)


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

        # Get promoted editions for this book
        kavita_promoted_edition = None
        plex_promoted_edition = None

        if book.kavita_url:
            kavita_promoted_edition = BookEdition.objects.filter(
                book=book, is_kavita_promoted=True
            ).first()

        if book.plex_url:
            plex_promoted_edition = BookEdition.objects.filter(
                book=book, is_plex_promoted=True
            ).first()

        data = json.loads(request.body)
        reload_page = False

        # Check if we should clear Hardcover data
        clear_hardcover_data = data.get("clear_hardcover_data", False)
        if clear_hardcover_data:
            # Clear Hardcover-specific data fields
            user_progress.hardcover_percent = None
            user_progress.hardcover_current_page = None
            user_progress.hardcover_current_position = None
            # Don't clear read ID or other fields that help with sync identification

        # Validate progress data
        progress_type = data.get("progress_type")
        progress_value = data.get("progress_value")

        if not progress_type or not progress_value:
            return JsonResponse(
                {"error": "Progress type and value are required"}, status=400
            )

        # Get book data for validation
        book_data = {
            "book": book,
            "edition": user_progress.edition,
            "kavita_promoted_edition": kavita_promoted_edition,
            "plex_promoted_edition": plex_promoted_edition,
        }

        # Validate progress value
        is_valid, result, seconds = ProgressValidator.validate(
            progress_type, progress_value, book_data
        )

        if not is_valid:
            return JsonResponse({"error": result}, status=400)

        # Update progress with validated value
        data["progress_value"] = ProgressValidator.format_progress_value(
            progress_type, result
        )

        # If it's audio progress and we have seconds, update Hardcover position
        if progress_type == "audio" and seconds is not None:
            if "hardcover_data" not in data:
                data["hardcover_data"] = {}
            data["hardcover_data"]["current_position"] = seconds

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
            for member in group.members.all():
                send_push_notification(
                    user=member,
                    title=f"New Active Book in {group.name}",
                    body=f"'{book.title}' by {book.author} is now the active book.",
                    url=request.build_absolute_uri(
                        reverse("book_detail", args=[book.id])
                    ),
                    icon=book.cover_image_url if book.cover_image_url else None,
                    notification_type="new_active_books",
                )

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

        # Get audio_seconds from hidden field if available
        audio_seconds = None
        if request.POST.get("audio_seconds"):
            try:
                audio_seconds = int(request.POST.get("audio_seconds"))
            except (ValueError, TypeError):
                pass

        # Get promoted editions for this book
        kavita_promoted_edition = None
        plex_promoted_edition = None

        if book.kavita_url:
            kavita_promoted_edition = BookEdition.objects.filter(
                book=book, is_kavita_promoted=True
            ).first()

        if book.plex_url:
            plex_promoted_edition = BookEdition.objects.filter(
                book=book, is_plex_promoted=True
            ).first()

        # Validate progress data
        book_data = {
            "book": book,
            "edition": user_progress.edition,
            "kavita_promoted_edition": kavita_promoted_edition,
            "plex_promoted_edition": plex_promoted_edition,
        }

        # Validate progress value
        is_valid, result, seconds = ProgressValidator.validate(
            progress_type, progress_value, book_data
        )

        if not is_valid:
            messages.error(request, f"Progress validation error: {result}")
            return render(
                request,
                "bookclub/set_manual_progress.html",
                {
                    "book": book,
                    "user_progress": user_progress,
                    "has_hardcover_key": bool(request.user.profile.hardcover_api_key),
                    "hardcover_read_id": hardcover_read_id,
                    "book_pages": book.pages,
                    "book_audio_seconds": book.audio_seconds,
                    "edition_pages": (
                        user_progress.edition.pages if user_progress.edition else None
                    ),
                    "edition_audio_seconds": (
                        user_progress.edition.audio_seconds
                        if user_progress.edition
                        else None
                    ),
                },
            )

        # Update progress with validated value
        user_progress.progress_type = progress_type
        user_progress.progress_value = ProgressValidator.format_progress_value(
            progress_type, result
        )

        # If it's audio progress and we have seconds, update Hardcover position
        if progress_type == "audio":
            # Use seconds from either validation or hidden field, prioritizing validation
            if seconds is not None:
                user_progress.hardcover_current_position = seconds
            elif audio_seconds is not None:
                user_progress.hardcover_current_position = audio_seconds

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
            elif user_progress.progress_type == "audio":
                # Use the hardcover_current_position if available
                if user_progress.hardcover_current_position:
                    seconds = user_progress.hardcover_current_position
                else:
                    # Fall back to parsing from progress_value
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

    # For GET request, prepare the template context
    # Add book and edition metadata for client-side validation
    book_pages = book.pages if book and book.pages else None
    book_audio_seconds = book.audio_seconds if book and book.audio_seconds else None
    edition_pages = None
    edition_audio_seconds = None

    if user_progress and user_progress.edition:
        edition_pages = user_progress.edition.pages
        edition_audio_seconds = user_progress.edition.audio_seconds

    return render(
        request,
        "bookclub/set_manual_progress.html",
        {
            "book": book,
            "user_progress": user_progress,
            "has_hardcover_key": bool(request.user.profile.hardcover_api_key),
            "hardcover_read_id": hardcover_read_id,
            "book_pages": book_pages,
            "book_audio_seconds": book_audio_seconds,
            "edition_pages": edition_pages,
            "edition_audio_seconds": edition_audio_seconds,
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

        # Only notify when book becomes active, not when deactivated
        for member in group.members.all():
            # Send to all members including the user who made the change
            send_push_notification(
                user=member,
                title=f"New Active Book in {group.name}",
                body=f"'{book.title}' by {book.author} is now the active book.",
                url=request.build_absolute_uri(reverse("book_detail", args=[book.id])),
                icon=book.cover_image_url if book.cover_image_url else None,
                notification_type="new_active_books",
            )

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
            return redirect(
                get_redirect_url_with_params(
                    request,
                    "book_detail",
                    {"book_id": book.id},
                    f"comment-{comment.id}",
                )
            )
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
        return redirect(f"{reverse('book_detail', args=[book.id])}?tab=discussion")

    return render(
        request, "bookclub/delete_comment.html", {"comment": comment, "book": book}
    )


@login_required
def toggle_reaction(request, comment_id):
    """Toggle a reaction on a comment"""
    return handle_comment_reaction(request, comment_id)


@login_required
def reply_to_comment(request, comment_id):
    """Handle replying to a comment"""
    return handle_reply_to_comment(request, comment_id)


@login_required
def manage_promoted_editions(request, book_id):
    """Allow admins to select promoted editions for Kavita and Plex"""
    book = get_object_or_404(Book, id=book_id)
    group = book.group

    # Check if user is a group admin
    if not group.is_admin(request.user):
        messages.error(
            request, "You don't have permission to manage promoted editions."
        )
        return redirect("book_detail", book_id=book.id)

    # Get currently promoted editions
    kavita_promoted = BookEdition.objects.filter(
        book=book, is_kavita_promoted=True
    ).first()
    plex_promoted = BookEdition.objects.filter(book=book, is_plex_promoted=True).first()

    # Try to get editions from Hardcover API
    editions = HardcoverAPI.get_book_editions(book.hardcover_id, user=request.user)

    if request.method == "POST":
        # Check for clear actions
        if request.POST.get("clear_kavita"):
            if kavita_promoted:
                kavita_promoted.is_kavita_promoted = False
                kavita_promoted.save(update_fields=["is_kavita_promoted"])
                messages.success(request, "Cleared the promoted Kavita edition.")

        elif request.POST.get("clear_plex"):
            if plex_promoted:
                plex_promoted.is_plex_promoted = False
                plex_promoted.save(update_fields=["is_plex_promoted"])
                messages.success(request, "Cleared the promoted Plex edition.")

        # Check for setting a Kavita edition
        elif request.POST.get("kavita_edition_id"):
            kavita_edition_id = request.POST.get("kavita_edition_id")

            # Clear any existing Kavita promotion
            BookEdition.objects.filter(book=book, is_kavita_promoted=True).update(
                is_kavita_promoted=False
            )

            # Find the edition in the API response
            kavita_edition_data = next(
                (e for e in editions if str(e["id"]) == kavita_edition_id), None
            )

            if kavita_edition_data:
                # Create or update the edition
                kavita_edition = create_or_update_book_edition(
                    book, kavita_edition_data
                )
                kavita_edition.is_kavita_promoted = True
                kavita_edition.save()  # Save all fields to ensure the edition exists completely
                messages.success(
                    request,
                    f"'{kavita_edition.title}' is now the promoted Kavita edition.",
                )
            else:
                messages.error(request, "Selected Kavita edition not found.")

        # Check for setting a Plex edition
        elif request.POST.get("plex_edition_id"):
            plex_edition_id = request.POST.get("plex_edition_id")

            # Clear any existing Plex promotion
            BookEdition.objects.filter(book=book, is_plex_promoted=True).update(
                is_plex_promoted=False
            )

            # Find the edition in the API response
            plex_edition_data = next(
                (e for e in editions if str(e["id"]) == plex_edition_id), None
            )

            if plex_edition_data:
                # Create or update the edition
                plex_edition = create_or_update_book_edition(book, plex_edition_data)
                plex_edition.is_plex_promoted = True
                plex_edition.save()  # Save all fields to ensure the edition exists completely
                messages.success(
                    request, f"'{plex_edition.title}' is now the promoted Plex edition."
                )
            else:
                messages.error(request, "Selected Plex edition not found.")

        # Get updated promoted editions after any changes
        kavita_promoted = BookEdition.objects.filter(
            book=book, is_kavita_promoted=True
        ).first()
        plex_promoted = BookEdition.objects.filter(
            book=book, is_plex_promoted=True
        ).first()

    # Check if we have Kavita and Plex URLs
    has_kavita = bool(book.kavita_url)
    has_plex = bool(book.plex_url)

    return render(
        request,
        "bookclub/manage_promoted_editions.html",
        {
            "book": book,
            "editions": editions,
            "kavita_promoted": kavita_promoted,
            "plex_promoted": plex_promoted,
            "has_kavita": has_kavita,
            "has_plex": has_plex,
        },
    )


@login_required
def quick_select_edition(request, book_id):
    """Quickly select a promoted edition for a book"""
    book = get_object_or_404(Book, id=book_id)

    if request.method == "POST":
        edition_id = request.POST.get("edition_id")
        source = request.POST.get("source")  # 'kavita' or 'plex'

        try:
            edition = BookEdition.objects.get(id=edition_id, book=book)

            # Get or create user progress
            user_progress, created = UserBookProgress.objects.get_or_create(
                user=request.user,
                book=book,
                defaults={
                    "progress_type": "percent",
                    "progress_value": "0",
                    "normalized_progress": 0,
                },
            )

            # Update user progress with the selected edition
            user_progress.edition = edition
            user_progress.save(update_fields=["edition"])

            # Customize message based on source
            if source == "kavita":
                messages.success(
                    request, f"You're now reading '{edition.title}' on Kavita."
                )
            elif source == "plex":
                messages.success(
                    request, f"You're now listening to '{edition.title}' on Plex."
                )
            else:
                messages.success(request, f"Selected edition: {edition.title}")

        except BookEdition.DoesNotExist:
            messages.error(request, "Selected edition not found.")

    return redirect("book_detail", book_id=book.id)


@login_required
@require_http_methods(["POST"])
def update_book_rating(request, book_id):
    """API endpoint to update a book rating, including half-star ratings"""
    # Parse the JSON data from request body
    try:
        data = json.loads(request.body)
        rating = data.get("rating")
        hardcover_read_id = data.get("hardcover_read_id")

        # Convert rating to Decimal or None
        if rating is not None:
            try:
                # Handle whole numbers and half-stars (like 3.5)
                rating = Decimal(str(rating))

                # Ensure rating is within valid range (0.5 to 5, in 0.5 steps)
                if rating > 0 and rating <= 5:
                    # Round to nearest 0.5
                    rating = round(rating * 2) / 2
                    if rating < 0.5:  # Minimum valid rating is 0.5
                        rating = Decimal("0.5")
                elif rating <= 0:
                    rating = None  # Treat 0 or negative as clearing the rating
            except (ValueError, TypeError):
                rating = None

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    # Get the book
    book = get_object_or_404(Book, id=book_id)

    # Get or create the user's progress for this book
    progress, created = UserBookProgress.objects.get_or_create(
        user=request.user,
        book=book,
        defaults={"progress_type": "percent", "progress_value": "0"},
    )

    # Update the rating
    old_rating = progress.local_rating
    progress.local_rating = rating
    progress.save()

    # Return success response with effective rating
    effective_rating = progress.effective_rating  # Use your model property

    return JsonResponse(
        {
            "success": True,
            "book_id": book_id,
            "rating": float(rating) if rating is not None else None,
            "effective_rating": (
                float(effective_rating) if effective_rating is not None else None
            ),
            "hardcover_read_id": hardcover_read_id,
            "is_hardcover_rating": bool(progress.hardcover_rating),
        }
    )


@login_required
def refresh_book_from_hardcover(request, book_id):
    """Refresh book details from Hardcover API"""
    book = get_object_or_404(Book, id=book_id)
    group = book.group

    # Check if user is a group admin
    if not group.is_admin(request.user):
        messages.error(request, "You don't have permission to refresh book details.")
        return redirect("book_detail", book_id=book.id)

    try:
        # Fetch updated book details from Hardcover
        book_data = HardcoverAPI.get_book_details(book.hardcover_id, user=request.user)

        if book_data:
            # Update book fields
            book.title = book_data.get("title", book.title)
            book.description = book_data.get("description", book.description)
            book.cover_image_url = book_data.get(
                "cover_image_url", book.cover_image_url
            )
            book.url = book_data.get("url", book.url)

            # Update author if available
            if book_data.get("author"):
                book.author = book_data["author"].get("name", book.author)

            book.save()

            # Optionally, refresh editions
            editions = HardcoverAPI.get_book_editions(
                book.hardcover_id, user=request.user
            )
            if editions:
                for edition_data in editions:
                    create_or_update_book_edition(book, edition_data)

            messages.success(
                request, f"Successfully refreshed details for '{book.title}'"
            )
        else:
            messages.error(
                request, "Could not retrieve updated book details from Hardcover"
            )

    except Exception as e:
        logger.exception(f"Error refreshing book details: {str(e)}")
        messages.error(request, f"An error occurred: {str(e)}")

    return redirect("book_detail", book_id=book.id)
