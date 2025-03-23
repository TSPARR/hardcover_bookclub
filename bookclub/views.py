from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from .forms import BookSearchForm, CommentForm, UserRegistrationForm
from .hardcover_api import HardcoverAPI
from .models import Book, Comment, Group


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
            search_results = HardcoverAPI.search_books(query)
    else:
        form = BookSearchForm()

    return render(
        request,
        "bookclub/search_books.html",
        {"form": form, "results": search_results, "group": group},
    )


@login_required
def add_book_to_group(request, group_id, hardcover_id):
    group = get_object_or_404(Group, id=group_id)

    # Get book details from Hardcover API
    book_data = HardcoverAPI.get_book_details(hardcover_id)

    if book_data:
        # Create or update book in database
        book, created = Book.objects.get_or_create(
            hardcover_id=hardcover_id,
            defaults={
                "title": book_data["title"],
                "author": book_data["author"],
                "cover_image_url": book_data.get("cover_url", ""),
                "description": book_data.get("description", ""),
                "group": group,
            },
        )

        if not created:
            # If book already exists, associate it with this group
            book.group = group
            book.save()

        return redirect("group_detail", group_id=group.id)

    # Handle error case
    return redirect("search_books", group_id=group.id)


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
