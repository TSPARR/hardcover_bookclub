"""
Group-related views for managing book groups.
"""

import logging

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render

from ..forms import GroupForm
from ..models import Book, BookGroup, MemberStartingPoint, User, UserBookProgress

logger = logging.getLogger(__name__)


@login_required
def home(request):
    # Get groups where the user is a member
    user_groups = list(request.user.book_groups.all())
    logger.debug(f"User {request.user.username} has {len(user_groups)} groups")

    # Get active books from these groups
    active_books = list(
        Book.objects.filter(group__in=user_groups, is_active=True).select_related(
            "group"
        )
    )

    logger.debug(f"Found {len(active_books)} active books")
    for book in active_books:
        logger.debug(
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
            logger.debug(
                f"Creating new progress for book: {book.title} (id: {book.id})"
            )
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

    logger.debug(f"Active book dictionary has {len(active_book_dict)} entries")
    for group_id, book in active_book_dict.items():
        logger.debug(f"Group ID {group_id} has active book: {book.title}")

    # Instead of creating dictionaries for groups, we'll simply attach the active_book to each group
    # This direct approach might be more reliable than we thought initially
    for group in user_groups:
        if group.id in active_book_dict:
            # Directly set the active_book attribute on the group instance
            group.active_book = active_book_dict[group.id]
            logger.debug(
                f"Set active_book for group '{group.name}' to '{group.active_book.title}'"
            )
        else:
            group.active_book = None
            logger.debug(f"No active book found for group '{group.name}'")

    # Check if the user can create groups
    can_create_groups = request.user.profile.can_create_groups

    # Add debugging for the render context
    logger.debug(f"Rendering with {len(books_with_progress)} active books")
    logger.debug(f"Rendering with {len(user_groups)} groups")

    # Force evaluate the queryset and log each group's active book
    for group in user_groups:
        if hasattr(group, "active_book") and group.active_book:
            logger.debug(
                f"Before render: Group '{group.name}' has active book '{group.active_book.title}'"
            )
        else:
            logger.debug(f"Before render: Group '{group.name}' has no active book")

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

    # Get books ordered by display_order
    books = group.books.all().order_by("display_order", "created_at")
    members = group.members.all()
    admins = group.admins.all()
    is_admin = group.is_admin(request.user)

    # Get user progress for all books in this group
    user_progress_dict = {}
    progress_entries = UserBookProgress.objects.filter(
        user=request.user, book__in=books
    )

    book_progress = {}
    for progress in progress_entries:
        # First, prioritize the progress's own edition
        progress.selected_edition = progress.edition

        # If no edition is set, then look for promoted editions
        if not progress.selected_edition:
            # Try Kavita promoted edition
            progress.selected_edition = progress.book.editions.filter(
                is_kavita_promoted=True
            ).first()

        # If still no edition, try Plex promoted
        if not progress.selected_edition:
            progress.selected_edition = progress.book.editions.filter(
                is_plex_promoted=True
            ).first()

        # If still no edition, get the first available edition
        if not progress.selected_edition:
            progress.selected_edition = progress.book.editions.first()

        if progress.hardcover_rating is not None:
            progress._temp_effective_rating = progress.hardcover_rating
        elif hasattr(progress, "local_rating") and progress.local_rating is not None:
            progress._temp_effective_rating = progress.local_rating
        else:
            progress._temp_effective_rating = None

        # Determine progress status
        if progress.normalized_progress == 0:
            status = "Not Started"
            status_class = "bg-secondary"
        elif progress.normalized_progress == 100:
            status = "Finished"
            status_class = "bg-success"
        else:
            status = "Reading"
            status_class = "bg-info"

        book_progress[progress.book_id] = {
            "progress": progress,
            "status": status,
            "status_class": status_class,
        }

    # For books without progress entries, add default "Not Started" status
    for book in books:
        if book.id not in book_progress:
            book_progress[book.id] = {
                "progress": None,
                "status": "Not Started",
                "status_class": "bg-secondary",
            }

    # Handle book order updates
    if request.method == "POST" and is_admin:
        if "book_order" in request.POST:
            # Process book reordering
            order_data = request.POST.getlist("book_order")
            for i, book_id in enumerate(order_data):
                Book.objects.filter(id=book_id, group=group).update(display_order=i)
            messages.success(request, "Book order has been updated.")
            return redirect("group_detail", group_id=group.id)

        elif "attribution" in request.POST:
            # Process book attribution update
            book_id = request.POST.get("book_id")
            picked_by_id = request.POST.get("picked_by")
            is_collective = request.POST.get("is_collective_pick") == "on"

            book = get_object_or_404(Book, id=book_id, group=group)

            if picked_by_id and not is_collective:
                book.picked_by = get_object_or_404(User, id=picked_by_id)
                book.is_collective_pick = False
            elif is_collective:
                book.picked_by = None
                book.is_collective_pick = True
            else:
                book.picked_by = None
                book.is_collective_pick = False

            book.save()
            messages.success(
                request, f"Attribution for '{book.title}' has been updated."
            )
            return redirect("group_detail", group_id=group.id)

    return render(
        request,
        "bookclub/group_detail.html",
        {
            "group": group,
            "books": books,
            "members": members,
            "admins": admins,
            "is_admin": is_admin,
            "book_progress": book_progress,
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


@login_required
def manage_group_books(request, group_id):
    """View for managing book order and attribution in a group"""
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is an admin of this group
    if not group.is_admin(request.user):
        messages.error(
            request, "You don't have permission to manage books in this group."
        )
        return redirect("group_detail", group_id=group.id)

    books = group.books.all().order_by("display_order", "created_at")
    members = group.members.all()

    if request.method == "POST":
        # Handle book reordering
        if "book_order" in request.POST:
            order_data = request.POST.getlist("book_order")
            for i, book_id in enumerate(order_data):
                Book.objects.filter(id=book_id, group=group).update(display_order=i)
            messages.success(request, "Book order has been updated.")

        # Handle book attribution
        if "attribution" in request.POST:
            book_id = request.POST.get("book_id")
            picked_by_id = request.POST.get("picked_by")
            is_collective = request.POST.get("is_collective_pick") == "on"

            book = get_object_or_404(Book, id=book_id, group=group)

            if picked_by_id and not is_collective:
                book.picked_by = get_object_or_404(User, id=picked_by_id)
                book.is_collective_pick = False
            elif is_collective:
                book.picked_by = None
                book.is_collective_pick = True
            else:
                book.picked_by = None
                book.is_collective_pick = False

            book.save()
            messages.success(
                request, f"Attribution for '{book.title}' has been updated."
            )

        return redirect("manage_group_books", group_id=group.id)

    return render(
        request,
        "bookclub/manage_group_books.html",
        {
            "group": group,
            "books": books,
            "members": members,
        },
    )


@login_required
def manage_member_starting_points(request, group_id):
    """View for managing when members joined the rotation."""
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is an admin of this group
    if not group.is_admin(request.user):
        messages.error(request, "You don't have permission to manage this group.")
        return redirect("group_detail", group_id=group.id)

    books = group.books.all().order_by("display_order", "created_at")
    members = group.members.all()

    # Get existing starting points
    existing_starting_points = MemberStartingPoint.objects.filter(
        group=group
    ).select_related("member", "starting_book")

    # Create a dictionary for easy lookup
    starting_points_dict = {sp.member.id: sp for sp in existing_starting_points}

    if request.method == "POST":
        member_id = request.POST.get("member_id")
        book_id = request.POST.get("book_id")
        notes = request.POST.get("notes", "")

        if member_id and book_id:
            member = get_object_or_404(User, id=member_id)
            book = get_object_or_404(Book, id=book_id, group=group)

            # Update or create the starting point
            MemberStartingPoint.objects.update_or_create(
                group=group,
                member=member,
                defaults={
                    "starting_book": book,
                    "notes": notes,
                    "set_by": request.user,
                },
            )

            messages.success(
                request,
                f"Starting point for {member.username} has been set to '{book.title}'.",
            )

        return redirect("manage_member_starting_points", group_id=group.id)

    return render(
        request,
        "bookclub/manage_member_starting_points.html",
        {
            "group": group,
            "books": books,
            "members": members,
            "starting_points_dict": starting_points_dict,
        },
    )


@login_required
def update_group_settings(request, group_id):
    """Handle updates to group settings including dollar bets toggle"""
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is an admin of the group
    if not group.is_admin(request.user):
        return HttpResponseForbidden("Only group admins can update settings")

    if request.method == "POST":
        # Update dollar bets setting if the site-wide setting is enabled
        if settings.ENABLE_DOLLAR_BETS:
            group.enable_dollar_bets = "enable_dollar_bets" in request.POST
            group.save()

        # Redirect back to the group detail page
        return redirect("group_detail", group_id=group.id)

    # If not a POST request, redirect to group detail
    return redirect("group_detail", group_id=group.id)
