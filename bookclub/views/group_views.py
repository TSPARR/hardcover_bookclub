"""
Group-related views for managing book groups.
"""

import logging
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from ..forms import GroupForm
from ..models import Book, BookGroup, User, UserBookProgress

logger = logging.getLogger(__name__)


@login_required
def home(request):
    # Get groups where the user is a member
    user_groups = list(request.user.book_groups.all())
    logger.info(f"User {request.user.username} has {len(user_groups)} groups")

    # Get active books from these groups
    active_books = list(
        Book.objects.filter(group__in=user_groups, is_active=True).select_related(
            "group"
        )
    )

    logger.info(f"Found {len(active_books)} active books")
    for book in active_books:
        logger.info(
            f"Active book: {book.title} in group: {book.group.name} (group_id: {book.group_id})"
        )

    # Prepare a list to store user progress for active books
    book_progresses = UserBookProgress.objects.filter(
        user=request.user, book__in=active_books
    )

    # Create a dictionary mapping book IDs to their progress
    progress_dict = {progress.book_id: progress for progress in book_progresses}

    # Ensure user progress exists for each active book
    for book in active_books:
        if book.id not in progress_dict:
            logger.info(f"Creating new progress for book: {book.title} (id: {book.id})")
            progress = UserBookProgress.objects.create(
                user=request.user,
                book=book,
                progress_type="percent",
                progress_value="0",
                normalized_progress=0,
            )
            progress_dict[book.id] = progress

    # Create books with progress data structure
    books_with_progress = []
    for book in active_books:
        book_data = {"book": book, "progress": progress_dict.get(book.id)}
        books_with_progress.append(book_data)

    # Create a dictionary to quickly look up active books by group_id
    active_book_dict = {}
    for book in active_books:
        active_book_dict[book.group_id] = book

    logger.info(f"Active book dictionary has {len(active_book_dict)} entries")
    for group_id, book in active_book_dict.items():
        logger.info(f"Group ID {group_id} has active book: {book.title}")

    # Instead of creating dictionaries for groups, we'll simply attach the active_book to each group
    # This direct approach might be more reliable than we thought initially
    for group in user_groups:
        if group.id in active_book_dict:
            # Directly set the active_book attribute on the group instance
            group.active_book = active_book_dict[group.id]
            logger.info(
                f"Set active_book for group '{group.name}' to '{group.active_book.title}'"
            )
        else:
            group.active_book = None
            logger.info(f"No active book found for group '{group.name}'")

    # Check if the user can create groups
    can_create_groups = request.user.profile.can_create_groups

    # Add debugging for the render context
    logger.info(f"Rendering with {len(books_with_progress)} active books")
    logger.info(f"Rendering with {len(user_groups)} groups")

    # Force evaluate the queryset and log each group's active book
    for group in user_groups:
        if hasattr(group, "active_book") and group.active_book:
            logger.info(
                f"Before render: Group '{group.name}' has active book '{group.active_book.title}'"
            )
        else:
            logger.info(f"Before render: Group '{group.name}' has no active book")

    return render(
        request,
        "bookclub/home.html",
        {
            "groups": user_groups,
            "active_books": books_with_progress,
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
