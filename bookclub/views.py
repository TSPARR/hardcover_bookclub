import json
import logging

import requests
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render

from .forms import ApiKeyForm, BookSearchForm, CommentForm, UserRegistrationForm
from .hardcover_api import HardcoverAPI
from .models import Book, Comment, Group, UserBookProgress

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


@login_required
def home(request):
    groups = Group.objects.all()
    return render(request, "bookclub/home.html", {"groups": groups})


@login_required
def group_detail(request, group_id):
    group = get_object_or_404(Group, id=group_id)
    books = group.books.all()
    return render(
        request, "bookclub/group_detail.html", {"group": group, "books": books}
    )


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

    # Get all comments for this book
    comments = book.comments.all()

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

    if request.method == "POST":
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.user = request.user
            comment.book = book

            # Get Hardcover progress data from hidden fields if available
            if request.POST.get("hardcover_data"):
                try:
                    hardcover_data = json.loads(request.POST.get("hardcover_data"))

                    # Save Hardcover data to the comment
                    comment.hardcover_started_at = hardcover_data.get("started_at")
                    comment.hardcover_finished_at = hardcover_data.get("finished_at")
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
                    user_progress.save()

                except json.JSONDecodeError as e:
                    logging.error(f"Error parsing Hardcover data: {e}")
            else:
                # Update user progress based on the comment's progress
                user_progress.progress_type = comment.progress_type
                user_progress.progress_value = comment.progress_value
                user_progress.save()

            comment.save()
            return redirect("book_detail", book_id=book.id)
    else:
        form = CommentForm()

    return render(
        request,
        "bookclub/book_detail.html",
        {
            "book": book,
            "comments": comments,
            "form": form,
            "current_sort": sort_by,
            "user_progress": user_progress,
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

        # Update progress fields
        if "progress_type" in data:
            user_progress.progress_type = data["progress_type"]

        if "progress_value" in data:
            user_progress.progress_value = data["progress_value"]

        # Process Hardcover data if available
        if "hardcover_data" in data:
            hardcover_data = data["hardcover_data"]
            user_progress.hardcover_started_at = hardcover_data.get("started_at")
            user_progress.hardcover_finished_at = hardcover_data.get("finished_at")
            user_progress.hardcover_percent = hardcover_data.get("progress")
            user_progress.hardcover_current_page = hardcover_data.get("current_page")
            user_progress.hardcover_current_position = hardcover_data.get(
                "current_position"
            )
            user_progress.hardcover_reading_format = hardcover_data.get(
                "reading_format"
            )
            user_progress.hardcover_edition_id = hardcover_data.get("edition_id")

            # Update book metadata if available and not already saved
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
                    "last_updated": user_progress.last_updated.strftime(
                        "%Y-%m-%d %H:%M:%S"
                    ),
                },
            }
        )

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON data"}, status=400)
    except Exception as e:
        logger.exception(f"Error updating book progress: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)


def _get_progress_value_for_sorting(comment):
    """
    Helper function to convert different progress types to comparable values
    Returns a value between 0 and 100 representing the reading progress
    """
    if comment.hardcover_percent is not None:
        return comment.hardcover_percent

    if comment.progress_type == "percent":
        try:
            # Extract numeric part from percentage string (e.g., "75%" -> 75)
            return float(comment.progress_value.replace("%", ""))
        except (ValueError, AttributeError):
            return 0

    elif comment.progress_type == "page":
        # If we have book pages and current page, calculate percentage
        if comment.book.pages and comment.hardcover_current_page:
            return (comment.hardcover_current_page / comment.book.pages) * 100

        # Try to parse progress_value as a page number
        try:
            page = int(comment.progress_value)
            if comment.book.pages:
                return (page / comment.book.pages) * 100
            return page  # If no total pages, just use the page number
        except (ValueError, AttributeError):
            return 0

    elif comment.progress_type == "audio":
        # For audio, convert to a percentage if we have total audio duration
        if comment.hardcover_current_position and comment.book.audio_seconds:
            return (
                comment.hardcover_current_position / comment.book.audio_seconds
            ) * 100

        # Otherwise, just use a default value since audio times are hard to compare
        return 50  # Middle value

    return 0  # Default case


@login_required
def search_books(request, group_id):
    group = get_object_or_404(Group, id=group_id)
    search_results = []

    if request.method == "POST":
        form = BookSearchForm(request.POST)
        if form.is_valid():
            query = form.cleaned_data["query"]
            logger.info(f"Processing search request for query: '{query}'")

            # Try the search
            try:
                search_results = HardcoverAPI.search_books(query, user=request.user)
                if not search_results:
                    logger.info("Search returned no results")
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
    group = get_object_or_404(Group, id=group_id)

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
                "description": book_data.get("description", ""),
                "group": group,
            },
        )

        if not created:
            # If book already exists, associate it with this group
            book.group = group
            book.save()

        messages.success(request, f"'{book.title}' has been added to the group.")
        return redirect("group_detail", group_id=group.id)

    # Handle error case
    messages.error(request, "Could not retrieve book details from Hardcover.")
    return redirect("search_books", group_id=group.id)


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


@login_required
def get_hardcover_progress(request, hardcover_id):
    """API endpoint to get a user's reading progress from Hardcover"""
    try:
        progress_data = HardcoverAPI.get_reading_progress(
            hardcover_id, user=request.user
        )
        return JsonResponse(progress_data)
    except Exception as e:
        logger.exception(f"Error fetching Hardcover progress: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)
