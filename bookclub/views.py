import logging

import requests
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from .forms import ApiKeyForm, BookSearchForm, CommentForm, UserRegistrationForm
from .hardcover_api import HardcoverAPI
from .models import Book, Comment, Group

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
    comments = book.comments.all().order_by("-created_at")

    if request.method == "POST":
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.user = request.user
            comment.book = book
            comment.save()
            return redirect("book_detail", book_id=book.id)
    else:
        form = CommentForm()

    return render(
        request,
        "bookclub/book_detail.html",
        {"book": book, "comments": comments, "form": form},
    )


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
