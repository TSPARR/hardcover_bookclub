"""
Book-related views for managing books, reading progress, etc.
"""

import json
import logging
from datetime import datetime

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from ..forms import BookSearchForm, CommentForm
from ..hardcover_api import HardcoverAPI
from ..models import (
    Book,
    BookEdition,
    BookGroup,
    Comment,
    CommentReaction,
    UserBookProgress,
)
from .utils import _get_progress_value_for_sorting, extract_publisher_name

logger = logging.getLogger(__name__)


@login_required
def book_detail(request, book_id):
    book = get_object_or_404(Book, id=book_id)

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
    if sort_by == "date_asc":
        comments = comments.order_by("created_at")
    elif sort_by == "date_desc":
        comments = comments.order_by("-created_at")
    elif sort_by == "progress_asc":
        # For progress sorting, we need custom logic
        # First, try to sort by Hardcover percent if available
        if comments.filter(hardcover_percent__isnull=False).exists():
            comments = comments.order_by("hardcover_percent", "-created_at")
        else:
            # Fallback to sorting by progress_type and value
            # This is more complex since progress_value can be different formats
            # We'll get all comments and sort in Python
            comments = list(comments.all())
            comments.sort(
                key=lambda c: _get_progress_value_for_sorting(c), reverse=False
            )
    elif sort_by == "progress_desc":
        # Similar to progress_asc but in reverse
        if comments.filter(hardcover_percent__isnull=False).exists():
            comments = comments.order_by("-hardcover_percent", "-created_at")
        else:
            comments = list(comments.all())
            comments.sort(
                key=lambda c: _get_progress_value_for_sorting(c), reverse=True
            )
    else:
        # Default to date descending
        comments = comments.order_by("-created_at")

    # Add normalized progress value to each comment for spoiler detection
    for comment in comments:
        comment.normalized_progress = _get_progress_value_for_sorting(comment)
        # For each comment, get its replies and add normalized progress to them too
        for reply in comment.get_replies():
            reply.normalized_progress = _get_progress_value_for_sorting(reply)

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

                    # Save Hardcover data to the comment with timezone-aware dates
                    started_at = hardcover_data.get("started_at")
                    finished_at = hardcover_data.get("finished_at")

                    # Make them timezone aware if they exist
                    if started_at:
                        comment.hardcover_started_at = timezone.make_aware(
                            timezone.datetime.strptime(started_at, "%Y-%m-%d")
                        )
                    else:
                        comment.hardcover_started_at = None

                    if finished_at:
                        comment.hardcover_finished_at = timezone.make_aware(
                            timezone.datetime.strptime(finished_at, "%Y-%m-%d")
                        )
                    else:
                        comment.hardcover_finished_at = None

                    comment.hardcover_percent = hardcover_data.get("progress")
                    comment.hardcover_current_page = hardcover_data.get("current_page")
                    comment.hardcover_current_position = hardcover_data.get(
                        "current_position"
                    )
                    comment.hardcover_reading_format = hardcover_data.get(
                        "reading_format"
                    )
                    comment.hardcover_edition_id = hardcover_data.get("edition_id")

                    # Update book metadata if available and not already saved
                    if hardcover_data.get("edition_pages") and not book.pages:
                        book.pages = hardcover_data.get("edition_pages")
                        book.save(update_fields=["pages"])

                    if (
                        hardcover_data.get("edition_audio_seconds")
                        and not book.audio_seconds
                    ):
                        book.audio_seconds = hardcover_data.get("edition_audio_seconds")
                        book.save(update_fields=["audio_seconds"])

                    # Update the user's book progress with the same data
                    user_progress.progress_type = comment.progress_type
                    user_progress.progress_value = comment.progress_value
                    user_progress.hardcover_started_at = comment.hardcover_started_at
                    user_progress.hardcover_finished_at = comment.hardcover_finished_at
                    user_progress.hardcover_percent = comment.hardcover_percent
                    user_progress.hardcover_current_page = (
                        comment.hardcover_current_page
                    )
                    user_progress.hardcover_current_position = (
                        comment.hardcover_current_position
                    )
                    user_progress.hardcover_reading_format = (
                        comment.hardcover_reading_format
                    )
                    user_progress.hardcover_edition_id = comment.hardcover_edition_id

                    # If there's an edition_id, try to link to the corresponding BookEdition
                    if comment.hardcover_edition_id:
                        try:
                            # Check if we already have this edition
                            edition = BookEdition.objects.get(
                                hardcover_edition_id=comment.hardcover_edition_id
                            )
                            user_progress.edition = edition
                            logger.debug(
                                f"Linked progress to existing edition ID: {comment.hardcover_edition_id}"
                            )
                        except BookEdition.DoesNotExist:
                            # Try to fetch and create the edition
                            try:
                                editions = HardcoverAPI.get_book_editions(
                                    book.hardcover_id, user=request.user
                                )
                                if editions:
                                    for edition_data in editions:
                                        if str(edition_data["id"]) == str(
                                            comment.hardcover_edition_id
                                        ):
                                            # Found the matching edition, create it
                                            edition = BookEdition.objects.create(
                                                book=book,
                                                hardcover_edition_id=comment.hardcover_edition_id,
                                                title=edition_data.get(
                                                    "title", book.title
                                                ),
                                                isbn=edition_data.get("isbn_10", ""),
                                                isbn13=edition_data.get("isbn_13", ""),
                                                cover_image_url=edition_data.get(
                                                    "cover_image_url", ""
                                                ),
                                                publisher=(
                                                    edition_data.get(
                                                        "publisher", {}
                                                    ).get("name", "")
                                                    if edition_data.get("publisher")
                                                    else ""
                                                ),
                                                pages=edition_data.get("pages"),
                                                audio_seconds=edition_data.get(
                                                    "audio_seconds"
                                                ),
                                                reading_format=edition_data.get(
                                                    "reading_format", ""
                                                ),
                                                reading_format_id=edition_data.get(
                                                    "reading_format_id"
                                                ),
                                            )

                                            # Set publication date if available
                                            if edition_data.get("release_date"):
                                                try:
                                                    edition.publication_date = (
                                                        datetime.strptime(
                                                            edition_data[
                                                                "release_date"
                                                            ],
                                                            "%Y-%m-%d",
                                                        ).date()
                                                    )
                                                    edition.save(
                                                        update_fields=[
                                                            "publication_date"
                                                        ]
                                                    )
                                                except (ValueError, TypeError):
                                                    pass

                                            user_progress.edition = edition
                                            logger.debug(
                                                f"Created and linked to new edition ID: {comment.hardcover_edition_id}"
                                            )
                                            break
                            except Exception as e:
                                logger.exception(
                                    f"Error fetching edition data: {str(e)}"
                                )

                    user_progress.save()

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
        auto_sync = data.get("auto_sync", False)
        reload_page = False

        # Update progress fields
        if "progress_type" in data and "progress_value" in data:
            # This is a manual update without Hardcover data
            if "hardcover_data" not in data:
                # Clear any existing Hardcover data to ensure manual entry takes precedence
                user_progress.hardcover_percent = None
                user_progress.hardcover_current_page = None
                user_progress.hardcover_current_position = None

            user_progress.progress_type = data["progress_type"]
            user_progress.progress_value = data["progress_value"]

        # Process Hardcover data if available
        if "hardcover_data" in data:
            hardcover_data = data["hardcover_data"]

            # Process timestamps to make them timezone-aware
            started_at = hardcover_data.get("started_at")
            finished_at = hardcover_data.get("finished_at")

            # Make them timezone aware if they exist
            if started_at:
                user_progress.hardcover_started_at = timezone.make_aware(
                    timezone.datetime.strptime(started_at, "%Y-%m-%d")
                )
            else:
                user_progress.hardcover_started_at = None

            if finished_at:
                user_progress.hardcover_finished_at = timezone.make_aware(
                    timezone.datetime.strptime(finished_at, "%Y-%m-%d")
                )
            else:
                user_progress.hardcover_finished_at = None

            user_progress.hardcover_percent = hardcover_data.get("progress")
            user_progress.hardcover_current_page = hardcover_data.get("current_page")
            user_progress.hardcover_current_position = hardcover_data.get(
                "current_position"
            )
            user_progress.hardcover_reading_format = hardcover_data.get(
                "reading_format"
            )
            user_progress.hardcover_edition_id = hardcover_data.get("edition_id")
            if "user_book_id" in hardcover_data:
                user_progress.hardcover_read_id = str(hardcover_data["user_book_id"])

            # Update book metadata if available and not already saved
            if hardcover_data.get("edition_pages") and not book.pages:
                book.pages = hardcover_data.get("edition_pages")
                book.save(update_fields=["pages"])

            if hardcover_data.get("edition_audio_seconds") and not book.audio_seconds:
                book.audio_seconds = hardcover_data.get("edition_audio_seconds")
                book.save(update_fields=["audio_seconds"])

            # Link to BookEdition if edition_id is available
            hardcover_edition_id = hardcover_data.get("edition_id")
            if hardcover_edition_id:
                try:
                    edition = BookEdition.objects.get(
                        hardcover_edition_id=str(hardcover_edition_id)
                    )
                    user_progress.edition = edition
                    logger.debug(
                        f"Linked progress to existing edition ID: {hardcover_edition_id}"
                    )
                except BookEdition.DoesNotExist:
                    # Edition doesn't exist yet, let's fetch it from Hardcover
                    try:
                        editions = HardcoverAPI.get_book_editions(
                            book.hardcover_id, user=request.user
                        )
                        if editions:
                            for edition_data in editions:
                                if str(edition_data["id"]) == str(hardcover_edition_id):
                                    # Found the matching edition, create it in our database
                                    edition = BookEdition.objects.create(
                                        book=book,
                                        hardcover_edition_id=str(hardcover_edition_id),
                                        title=edition_data.get("title", book.title),
                                        isbn=edition_data.get("isbn_10", ""),
                                        isbn13=edition_data.get("isbn_13", ""),
                                        cover_image_url=edition_data.get(
                                            "cover_image_url", ""
                                        ),
                                        publisher=extract_publisher_name(
                                            edition_data.get("publisher", "")
                                        ),
                                        pages=edition_data.get("pages"),
                                        audio_seconds=edition_data.get("audio_seconds"),
                                        reading_format=edition_data.get(
                                            "reading_format", ""
                                        ),
                                        reading_format_id=edition_data.get(
                                            "reading_format_id"
                                        ),
                                    )

                                    # Set publication date if available
                                    if edition_data.get("release_date"):
                                        try:
                                            edition.publication_date = (
                                                datetime.strptime(
                                                    edition_data["release_date"],
                                                    "%Y-%m-%d",
                                                ).date()
                                            )
                                            edition.save(
                                                update_fields=["publication_date"]
                                            )
                                        except (ValueError, TypeError):
                                            pass

                                    user_progress.edition = edition
                                    logger.debug(
                                        f"Created and linked to new edition ID: {hardcover_edition_id}"
                                    )
                                    # Set flag to reload page if this is a new edition
                                    reload_page = True
                                    break
                    except Exception as e:
                        logger.exception(f"Error fetching edition data: {str(e)}")

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

    # Get book details from Hardcover API
    book_data = HardcoverAPI.get_book_details(hardcover_id, user=request.user)

    if book_data:
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
            },
        )

        if not created:
            # If book already exists, associate it with this group
            book.group = group
            if not book.url and book_data.get("url"):
                book.url = book_data.get("url")
            book.save()

        messages.success(request, f"'{book.title}' has been added to the group.")
        return redirect("group_detail", group_id=group.id)

    # Handle error case
    messages.error(request, "Could not retrieve book details from Hardcover.")
    return redirect("search_books", group_id=group.id)


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

        # Find or create the edition in our database
        for edition_data in editions:
            if str(edition_data["id"]) == edition_id:
                # Create or update the edition in our database
                edition, created = BookEdition.objects.update_or_create(
                    hardcover_edition_id=edition_id,
                    defaults={
                        "book": book,
                        "title": edition_data.get("title", book.title),
                        "isbn": edition_data.get("isbn_10", ""),
                        "isbn13": edition_data.get("isbn_13", ""),
                        "cover_image_url": (
                            edition_data.get("cached_image", {}).get("url", "")
                            if edition_data.get("cached_image")
                            else ""
                        ),
                        "publisher": (
                            edition_data.get("publisher", {}).get("name", "")
                            if edition_data.get("publisher")
                            else ""
                        ),
                        "pages": edition_data.get("pages"),
                        "audio_seconds": edition_data.get("audio_seconds"),
                        "reading_format": edition_data.get("reading_format", ""),
                        "reading_format_id": edition_data.get("reading_format_id"),
                    },
                )

                # Update publication date if available
                if edition_data.get("release_date"):
                    try:
                        edition.publication_date = datetime.strptime(
                            edition_data["release_date"], "%Y-%m-%d"
                        ).date()
                        edition.save()
                    except (ValueError, TypeError):
                        pass

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
                hardcover_read_id = hardcover_progress.get("hardcover_read_id")
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
        hardcover_sync_result = None
        if sync_to_hardcover and request.user.profile.hardcover_api_key:
            # Only sync if we have a hardcover_read_id or can determine it
            if hardcover_read_id:
                try:
                    # Determine progress value and type to send to Hardcover
                    progress_percent = int(user_progress.normalized_progress)

                    # Get edition info if available
                    edition_id = None
                    reading_format_id = None
                    edition_data = None

                    if user_progress.edition:
                        if user_progress.edition.hardcover_edition_id:
                            edition_id = int(user_progress.edition.hardcover_edition_id)

                        if user_progress.edition.reading_format_id:
                            reading_format_id = user_progress.edition.reading_format_id

                        # Create edition data object for accurate progress conversion
                        edition_data = {
                            "pages": user_progress.edition.pages,
                            "audio_seconds": user_progress.edition.audio_seconds,
                        }

                    # Determine progress value based on progress type
                    progress_value = None

                    if (
                        user_progress.progress_type == "page"
                        and user_progress.progress_value
                    ):
                        try:
                            # Send raw page number for page-based formats
                            progress_value = int(user_progress.progress_value)
                            # If we have total pages, use percentage instead
                            if user_progress.edition and user_progress.edition.pages:
                                progress_percent = min(
                                    100,
                                    int(
                                        (progress_value / user_progress.edition.pages)
                                        * 100
                                    ),
                                )
                        except (ValueError, TypeError):
                            # Fall back to calculated normalized progress
                            progress_value = None

                    elif (
                        user_progress.progress_type == "audio"
                        and user_progress.progress_value
                    ):
                        # Parse audio timestamp (e.g., "2h 30m" or "45m")
                        try:
                            seconds = 0
                            if "h" in user_progress.progress_value:
                                parts = user_progress.progress_value.split()
                                hours_part = next((p for p in parts if "h" in p), None)
                                if hours_part:
                                    seconds += int(hours_part.replace("h", "")) * 3600

                                minutes_part = next(
                                    (p for p in parts if "m" in p), None
                                )
                                if minutes_part:
                                    seconds += int(minutes_part.replace("m", "")) * 60
                            elif "m" in user_progress.progress_value:
                                seconds = (
                                    int(user_progress.progress_value.replace("m", ""))
                                    * 60
                                )

                            if seconds > 0:
                                progress_value = seconds
                                # If we have total audio_seconds, calculate percentage
                                if (
                                    user_progress.edition
                                    and user_progress.edition.audio_seconds
                                ):
                                    progress_percent = min(
                                        100,
                                        int(
                                            (
                                                seconds
                                                / user_progress.edition.audio_seconds
                                            )
                                            * 100
                                        ),
                                    )
                        except (ValueError, TypeError):
                            # Fall back to calculated normalized progress
                            progress_value = None

                    # If we couldn't determine a specific progress value, use percentage
                    if progress_value is None:
                        progress_value = progress_percent

                    hardcover_sync_result = HardcoverAPI.update_reading_progress(
                        user_book_read_id=hardcover_read_id,
                        progress=progress_value,
                        edition_id=edition_id,
                        reading_format_id=reading_format_id,
                        edition=edition_data if edition_data else None,
                        started_at=user_progress.hardcover_started_at,
                        finished_at=user_progress.hardcover_finished_at,
                        user=request.user,
                    )

                    if hardcover_sync_result and not isinstance(
                        hardcover_sync_result, dict
                    ):
                        messages.success(
                            request, "Progress was updated and synced to Hardcover."
                        )
                    elif hardcover_sync_result and "error" in hardcover_sync_result:
                        messages.warning(
                            request,
                            f"Local progress updated but Hardcover sync failed: {hardcover_sync_result['error']}",
                        )
                    else:
                        messages.warning(
                            request, "Local progress updated but Hardcover sync failed."
                        )

                except Exception as e:
                    logger.exception(f"Error syncing to Hardcover: {str(e)}")
                    messages.warning(
                        request,
                        f"Local progress updated but Hardcover sync failed: {str(e)}",
                    )
            else:
                # No existing record found, try to create a new one
                try:
                    # Format progress data for starting a new read
                    edition_id = None
                    pages = None
                    seconds = None

                    if (
                        user_progress.edition
                        and user_progress.edition.hardcover_edition_id
                    ):
                        edition_id = int(user_progress.edition.hardcover_edition_id)

                    # Determine format-specific progress
                    if (
                        user_progress.progress_type == "page"
                        and user_progress.progress_value
                    ):
                        try:
                            pages = int(user_progress.progress_value)
                        except (ValueError, TypeError):
                            pass
                    elif (
                        user_progress.progress_type == "audio"
                        and user_progress.progress_value
                    ):
                        try:
                            seconds = 0
                            if "h" in user_progress.progress_value:
                                parts = user_progress.progress_value.split()
                                hours_part = next((p for p in parts if "h" in p), None)
                                if hours_part:
                                    seconds += int(hours_part.replace("h", "")) * 3600

                                minutes_part = next(
                                    (p for p in parts if "m" in p), None
                                )
                                if minutes_part:
                                    seconds += int(minutes_part.replace("m", "")) * 60
                            elif "m" in user_progress.progress_value:
                                seconds = (
                                    int(user_progress.progress_value.replace("m", ""))
                                    * 60
                                )
                        except (ValueError, TypeError):
                            pass

                    # Use normalized progress as fallback for percentage
                    if (
                        not pages
                        and not seconds
                        and user_progress.progress_type == "percent"
                    ):
                        # For percentage, we need to convert to pages or seconds if possible
                        if user_progress.edition:
                            if (
                                user_progress.edition.reading_format_id == 2
                                and user_progress.edition.audio_seconds
                            ):
                                # Audio format
                                seconds = int(
                                    (user_progress.normalized_progress / 100)
                                    * user_progress.edition.audio_seconds
                                )
                            elif (
                                user_progress.edition.reading_format_id in [1, 4]
                                and user_progress.edition.pages
                            ):
                                # Physical or ebook format
                                pages = int(
                                    (user_progress.normalized_progress / 100)
                                    * user_progress.edition.pages
                                )

                    # Start a new reading record on Hardcover
                    start_result = HardcoverAPI.start_reading_progress(
                        book_id=book.hardcover_id,
                        edition_id=edition_id,
                        pages=pages,
                        seconds=seconds,
                        started_at=user_progress.hardcover_started_at or timezone.now(),
                        user=request.user,
                    )

                    if (
                        start_result
                        and "success" in start_result
                        and "read_id" in start_result
                    ):
                        # Save the read ID for future updates
                        user_progress.hardcover_read_id = str(start_result["read_id"])
                        user_progress.save(update_fields=["hardcover_read_id"])

                        messages.success(
                            request,
                            "Started tracking this book on Hardcover and synced your progress!",
                        )
                    elif start_result and "error" in start_result:
                        messages.warning(
                            request,
                            f"Local progress updated but couldn't start Hardcover tracking: {start_result['error']}",
                        )
                    else:
                        messages.warning(
                            request,
                            "Local progress updated but couldn't start Hardcover tracking.",
                        )

                except Exception as e:
                    logger.exception(f"Error starting Hardcover tracking: {str(e)}")
                    messages.warning(
                        request,
                        f"Local progress updated but couldn't start Hardcover tracking: {str(e)}",
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

        # Get updated reaction counts
        reaction_counts = (
            CommentReaction.objects.filter(comment=comment)
            .values("reaction")
            .annotate(count=Count("id"))
        )
        counts_dict = {item["reaction"]: item["count"] for item in reaction_counts}

        return JsonResponse(
            {
                "success": True,
                "action": action,
                "reaction": reaction_type,
                "counts": counts_dict,
            }
        )

    except Exception as e:
        logger.exception(f"Error toggling reaction: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)


@login_required
def reply_to_comment(request, comment_id):
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

                    logger.debug(
                        f"About to save reply with: user={reply.user.id}, book={reply.book.id}, parent={reply.parent.id}"
                    )
                    reply.save()
                    logger.debug(f"Reply saved successfully with ID: {reply.id}")

                    messages.success(request, "Your reply has been posted.")
                    redirect_url = f"{reverse('book_detail', args=[book.id])}#comment-{parent_comment.id}"
                    logger.debug(f"Redirecting to: {redirect_url}")
                    return redirect(redirect_url)
                except Exception as e:
                    logger.error(f"Error saving reply: {str(e)}", exc_info=True)
                    messages.error(request, f"Error saving your reply: {str(e)}")
            else:
                logger.warning(f"Form validation failed. Errors: {form.errors}")
                messages.error(request, "Please correct the errors in your form.")
        else:
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
