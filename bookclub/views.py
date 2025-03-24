import json
import logging

import requests
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from .forms import (
    ApiKeyForm,
    BookSearchForm,
    CommentForm,
    GroupForm,
    UserRegistrationForm,
)
from .hardcover_api import HardcoverAPI
from .models import (
    Book,
    BookGroup,
    Comment,
    User,
    UserBookProgress,
    UserProfile,
    BookEdition,
)

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
    # Get groups where the user is a member
    user_groups = request.user.book_groups.all()

    # Get active books from these groups
    active_books = Book.objects.filter(
        group__in=user_groups, is_active=True
    ).select_related("group")

    # Get the user's progress for these active books
    for book in active_books:
        book.user_progress, created = UserBookProgress.objects.get_or_create(
            user=request.user,
            book=book,
            defaults={
                "progress_type": "percent",
                "progress_value": "0",
                "normalized_progress": 0,
            },
        )

    # Add active book to each group for easy access in the template
    # Create a dictionary to quickly look up active books by group_id
    active_book_by_group = {book.group_id: book for book in active_books}

    for group in user_groups:
        group.active_book = active_book_by_group.get(group.id)

    # Check if the user can create groups
    can_create_groups = request.user.profile.can_create_groups

    return render(
        request,
        "bookclub/home.html",
        {
            "groups": user_groups,
            "active_books": active_books,
            "can_create_groups": can_create_groups,
        },
    )


@login_required
def group_detail(request, group_id):
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is a member of this group
    if not group.is_member(request.user):
        messages.error(request, "You are not a member of this group.")
        return redirect("home")

    books = group.books.all()
    members = group.members.all()
    admins = group.admins.all()
    is_admin = group.is_admin(request.user)

    return render(
        request,
        "bookclub/group_detail.html",
        {
            "group": group,
            "books": books,
            "members": members,
            "admins": admins,
            "is_admin": is_admin,
        },
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
                            logger.info(
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
                                                    from datetime import datetime

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
                                            logger.info(
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


def extract_publisher_name(publisher_data):
    """Extract publisher name from different data formats"""
    if not publisher_data:
        return ""

    # If it's already a string, return it
    if isinstance(publisher_data, str):
        # If it looks like a dictionary string, try to parse it
        if publisher_data.startswith("{") and "name" in publisher_data:
            try:
                import ast

                publisher_dict = ast.literal_eval(publisher_data)
                if isinstance(publisher_dict, dict) and "name" in publisher_dict:
                    return publisher_dict["name"]
            except:
                pass
        return publisher_data

    # If it's a dict with 'name' key
    if isinstance(publisher_data, dict) and "name" in publisher_data:
        return publisher_data["name"]

    # Return as string as fallback
    return str(publisher_data)


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
                # Check if we already have this edition in our system
                try:
                    edition = BookEdition.objects.get(
                        hardcover_edition_id=str(hardcover_edition_id)
                    )
                    user_progress.edition = edition
                    logger.info(
                        f"Linked progress to existing edition ID: {hardcover_edition_id}"
                    )
                except BookEdition.DoesNotExist:
                    # Edition doesn't exist yet, let's fetch it from Hardcover
                    try:
                        # We'll use the get_book_editions method to get all editions, then find the matching one
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
                                            from datetime import datetime

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
                                    logger.info(
                                        f"Created and linked to new edition ID: {hardcover_edition_id}"
                                    )
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
    group = get_object_or_404(BookGroup, id=group_id)
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


@login_required
def create_group(request):
    # Check if user has permission to create groups
    if not request.user.profile.can_create_groups:
        messages.error(request, "You don't have permission to create groups.")
        return redirect("home")

    if request.method == "POST":
        form = GroupForm(request.POST)
        if form.is_valid():
            group = form.save()

            # Add creator as both member and admin
            group.members.add(request.user)
            group.admins.add(request.user)

            messages.success(request, f"Group '{group.name}' has been created.")
            return redirect("group_detail", group_id=group.id)
    else:
        form = GroupForm()

    return render(request, "bookclub/create_group.html", {"form": form})


@login_required
def group_detail(request, group_id):
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is a member of this group
    if not group.is_member(request.user):
        messages.error(request, "You are not a member of this group.")
        return redirect("home")

    books = group.books.all()
    members = group.members.all()
    admins = group.admins.all()
    is_admin = group.is_admin(request.user)

    return render(
        request,
        "bookclub/group_detail.html",
        {
            "group": group,
            "books": books,
            "members": members,
            "admins": admins,
            "is_admin": is_admin,
        },
    )


@login_required
def manage_group_members(request, group_id):
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is an admin of this group
    if not group.is_admin(request.user):
        messages.error(request, "You don't have permission to manage this group.")
        return redirect("group_detail", group_id=group.id)

    if request.method == "POST":
        action = request.POST.get("action")
        user_id = request.POST.get("user_id")
        user_to_modify = get_object_or_404(User, id=user_id)

        if action == "remove":
            # Remove user from group
            group.members.remove(user_to_modify)
            # Also remove from admins if they were an admin
            if group.is_admin(user_to_modify):
                group.admins.remove(user_to_modify)
            messages.success(
                request, f"{user_to_modify.username} has been removed from the group."
            )

        elif action == "make_admin":
            # Make user an admin (must already be a member)
            if group.is_member(user_to_modify):
                group.admins.add(user_to_modify)
                messages.success(
                    request, f"{user_to_modify.username} is now an admin of this group."
                )
            else:
                messages.error(
                    request,
                    f"{user_to_modify.username} must be a member of the group first.",
                )

        elif action == "remove_admin":
            # Remove admin privileges
            group.admins.remove(user_to_modify)
            messages.success(
                request,
                f"{user_to_modify.username} is no longer an admin of this group.",
            )

        return redirect("manage_group_members", group_id=group.id)

    # Get all users for adding new members
    all_users = User.objects.all().exclude(
        id__in=group.members.all().values_list("id", flat=True)
    )

    return render(
        request,
        "bookclub/manage_group_members.html",
        {
            "group": group,
            "members": group.members.all(),
            "admins": group.admins.all(),
            "available_users": all_users,
        },
    )


@login_required
def add_group_member(request, group_id):
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is an admin of this group
    if not group.is_admin(request.user):
        messages.error(request, "You don't have permission to manage this group.")
        return redirect("group_detail", group_id=group.id)

    if request.method == "POST":
        user_id = request.POST.get("user_id")
        user_to_add = get_object_or_404(User, id=user_id)

        # Add user to the group
        group.members.add(user_to_add)
        messages.success(
            request, f"{user_to_add.username} has been added to the group."
        )

        return redirect("manage_group_members", group_id=group.id)

    return redirect("manage_group_members", group_id=group.id)


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
                    from datetime import datetime

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

    if request.method == "POST":
        progress_type = request.POST.get("progress_type")
        progress_value = request.POST.get("progress_value")
        started_reading = request.POST.get("started_reading") == "on"
        finished_reading = request.POST.get("finished_reading") == "on"

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

        messages.success(request, "Reading progress updated successfully.")
        return redirect("book_detail", book_id=book.id)

    return render(
        request,
        "bookclub/set_manual_progress.html",
        {
            "book": book,
            "user_progress": user_progress,
        },
    )


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
