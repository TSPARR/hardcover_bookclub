from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render

from ..models import Book, BookGroup, DollarBet, User


@login_required
def dollar_bets_list(request, book_id):
    """View to list all dollar bets for a book"""
    book = get_object_or_404(Book, id=book_id)
    group = book.group

    # Check if dollar bets are enabled for this group
    if not group.is_dollar_bets_enabled():
        return HttpResponseForbidden("Dollar bets are not enabled for this group")

    # Check if user is a member of the group
    if not group.is_member(request.user):
        return HttpResponseForbidden("You're not a member of this group")

    bets = DollarBet.objects.filter(book=book).order_by("-created_at")

    return render(
        request,
        "bookclub/dollar_bets_list.html",
        {
            "book": book,
            "group": group,
            "bets": bets,
            "is_admin": group.is_admin(request.user),
        },
    )


@login_required
def create_dollar_bet(request, book_id):
    """View to create a new dollar bet"""
    book = get_object_or_404(Book, id=book_id)
    group = book.group

    # Check if dollar bets are enabled for this group
    if not group.is_dollar_bets_enabled():
        return HttpResponseForbidden("Dollar bets are not enabled for this group")

    # Check if user is a member of the group
    if not group.is_member(request.user):
        return HttpResponseForbidden("You're not a member of this group")

    if request.method == "POST":
        description = request.POST.get("description")
        spoiler_level = request.POST.get("spoiler_level", "halfway")

        if not description:
            return JsonResponse({"error": "Description is required"}, status=400)

        bet = DollarBet.objects.create(
            book=book,
            group=group,
            proposer=request.user,
            description=description,
            amount=1.00,  # Fixed at $1
            spoiler_level=spoiler_level,
        )

        # Redirect to book detail with bets tab active
        return redirect(f"/books/{book.id}/?tab=bets")

    return render(
        request,
        "bookclub/create_dollar_bet.html",
        {
            "book": book,
            "group": group,
        },
    )


@login_required
def accept_dollar_bet(request, bet_id):
    """View to accept a dollar bet"""
    bet = get_object_or_404(DollarBet, id=bet_id)
    group = bet.group
    book = bet.book

    # Check if dollar bets are enabled for this group
    if not group.is_dollar_bets_enabled():
        return HttpResponseForbidden("Dollar bets are not enabled for this group")

    # Check if user is a member of the group
    if not group.is_member(request.user):
        return HttpResponseForbidden("You're not a member of this group")

    # Cannot accept your own bet
    if bet.proposer == request.user:
        return HttpResponseForbidden("You cannot accept your own bet")

    if bet.status != "open":
        return HttpResponseForbidden("This bet is no longer open")

    bet.accept(request.user)

    # Redirect to book detail with bets tab active
    return redirect(f"/books/{book.id}/?tab=bets")


@login_required
def resolve_dollar_bet(request, bet_id):
    """View for admins to resolve a dollar bet (mark as won/lost)"""
    bet = get_object_or_404(DollarBet, id=bet_id)
    group = bet.group
    book = bet.book

    # Check if dollar bets are enabled for this group
    if not group.is_dollar_bets_enabled():
        return HttpResponseForbidden("Dollar bets are not enabled for this group")

    # Check if user is an admin of the group
    if not group.is_admin(request.user):
        return HttpResponseForbidden("Only group admins can resolve bets")

    if bet.status != "accepted":
        return HttpResponseForbidden("Only accepted bets can be resolved")

    if request.method == "POST":
        winner_id = request.POST.get("winner")
        winner = get_object_or_404(User, id=winner_id)

        # Validate winner is either proposer or accepter
        if winner not in [bet.proposer, bet.accepter]:
            return JsonResponse({"error": "Invalid winner"}, status=400)

        # If not already set as 'finished' level, upgrade spoiler level to 'finished'
        # This ensures resolved bets are only visible to those who have completed the book
        if bet.spoiler_level != "finished":
            bet.spoiler_level = "finished"

        bet.resolve(winner, request.user)

        # Redirect to book detail with bets tab active
        return redirect(f"/books/{book.id}/?tab=bets")

    return render(
        request,
        "bookclub/resolve_dollar_bet.html",
        {
            "bet": bet,
        },
    )


@login_required
def cancel_dollar_bet(request, bet_id):
    """View to cancel an open dollar bet"""
    bet = get_object_or_404(DollarBet, id=bet_id)
    group = bet.group
    book = bet.book

    # Check if dollar bets are enabled for this group
    if not group.is_dollar_bets_enabled():
        return HttpResponseForbidden("Dollar bets are not enabled for this group")

    # Only proposer can cancel their bet
    if bet.proposer != request.user:
        return HttpResponseForbidden("Only the proposer can cancel this bet")

    if bet.status != "open":
        return HttpResponseForbidden("This bet cannot be canceled")

    bet.cancel()

    # Redirect to book detail with bets tab active
    return redirect(f"/books/{book.id}/?tab=bets")


@login_required
def dollar_bets_group_list(request, group_id):
    """View to list all dollar bets for a group"""
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if dollar bets are enabled for this group
    if not group.is_dollar_bets_enabled():
        return HttpResponseForbidden("Dollar bets are not enabled for this group")

    # Check if user is a member of the group
    if not group.is_member(request.user):
        return HttpResponseForbidden("You're not a member of this group")

    bets = DollarBet.objects.filter(group=group).order_by("-created_at")
    books = group.books.all()

    return render(
        request,
        "bookclub/dollar_bets_group_list.html",
        {
            "group": group,
            "bets": bets,
            "books": books,
            "is_admin": group.is_admin(request.user),
        },
    )


@login_required
def admin_create_dollar_bet(request, book_id):
    """Admin view to create a new dollar bet with specific proposer and accepter"""
    book = get_object_or_404(Book, id=book_id)
    group = book.group

    # Check if dollar bets are enabled for this group
    if not group.is_dollar_bets_enabled():
        return HttpResponseForbidden("Dollar bets are not enabled for this group")

    # Check if user is an admin of the group
    if not group.is_admin(request.user):
        return HttpResponseForbidden("Only group admins can create bets for others")

    # Get all members of the group for the dropdown selection
    members = group.members.all()

    if request.method == "POST":
        description = request.POST.get("description")
        proposer_id = request.POST.get("proposer")
        accepter_id = request.POST.get("accepter")
        spoiler_level = request.POST.get("spoiler_level", "halfway")

        if not description:
            messages.error(request, "Description is required")
            return redirect("admin_create_dollar_bet", book_id=book.id)

        if proposer_id == accepter_id:
            messages.error(request, "Proposer and accepter must be different users")
            return redirect("admin_create_dollar_bet", book_id=book.id)

        proposer = get_object_or_404(User, id=proposer_id)
        accepter = get_object_or_404(User, id=accepter_id)

        # Ensure both users are members of the group
        if not group.is_member(proposer) or not group.is_member(accepter):
            messages.error(request, "Both users must be members of the group")
            return redirect("admin_create_dollar_bet", book_id=book.id)

        # Create bet with immediately accepted status
        bet = DollarBet.objects.create(
            book=book,
            group=group,
            proposer=proposer,
            accepter=accepter,
            description=description,
            amount=1.00,
            status="accepted",
            spoiler_level=spoiler_level,
        )

        messages.success(
            request, "Dollar bet created successfully between selected members"
        )
        return redirect(f"/books/{book.id}/?tab=bets")

    return render(
        request,
        "bookclub/admin_create_dollar_bet.html",
        {
            "book": book,
            "group": group,
            "members": members,
            "spoiler_levels": DollarBet.SPOILER_LEVEL_CHOICES,
        },
    )
