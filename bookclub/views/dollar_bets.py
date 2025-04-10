import random

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render

from ..models import Book, BookGroup, DollarBet, User
from ..notifications import send_push_notification


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

        # Send notifications to all group members (except the proposer)
        for member in group.members.all():
            if member != request.user:  # Don't notify the proposer
                send_push_notification(
                    user=member,
                    title=f"New Dollar Bet in {group.name}",
                    body=f"{request.user.username} proposed: \"{description[:50]}{'...' if len(description) > 50 else ''}\"",
                    url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
                    icon=book.cover_image_url if book.cover_image_url else None,
                    notification_type="new_dollar_bets",
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
    """View to accept a dollar bet, optionally with a counter-bet"""
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

    if request.method == "POST":
        counter_description = request.POST.get("counter_description", "").strip()

        # Accept the bet with optional counter description
        bet.accept(request.user, counter_description if counter_description else None)

        # Prepare notification message based on whether a counter-bet was provided
        notification_body = ""
        if counter_description:
            notification_body = f"{request.user.username} accepted your bet with a counter: \"{counter_description[:50]}{'...' if len(counter_description) > 50 else ''}\""
        else:
            notification_body = f"{request.user.username} accepted your bet: \"{bet.description[:50]}{'...' if len(bet.description) > 50 else ''}\""

        # Notify the proposer that their bet was accepted
        send_push_notification(
            user=bet.proposer,
            title="Your Dollar Bet was Accepted!",
            body=notification_body,
            url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
            icon=book.cover_image_url if book.cover_image_url else None,
            notification_type="bet_accepted",
        )

        # Redirect to book detail with bets tab active
        return redirect(f"/books/{book.id}/?tab=bets")

    # If GET request, display the form for accepting a bet
    return render(
        request,
        "bookclub/accept_dollar_bet.html",
        {
            "bet": bet,
            "book": book,
            "group": group,
        },
    )


# Fun phrases for winner notifications
WINNER_PHRASES = [
    "🎉 You Won the Dollar Bet!",
    "💰 Jackpot! You Won the Bet",
    "🏆 Victory! The Dollar is Yours",
    "📚 Bookworm Triumph! You Won",
    "🥇 Champion Reader! Bet Won",
    "🍀 Lucky Guess! You Won",
    "👑 Reading Royalty! Your Bet Paid Off",
    "🔮 Your Prediction Was Spot On!",
    "💵 Cash Money! You Won the Bet",
    "🧠 Literary Genius! Bet Won",
]

# Fun phrases for the winner notification body
WINNER_BODY_PHRASES = [
    "Congratulations! Time to collect your hard-earned dollar from {loser}.",
    "Your literary intuition was right! {loser} owes you $1.",
    "Well predicted! Maybe {loser} should buy you a coffee with that dollar.",
    "You called it! {loser} might want to consult you for future predictions.",
    "Spot on! Don't spend that dollar all in one place.",
    "Expert prediction! {loser} should frame that dollar for you.",
    "Brilliant call! That's why you're the book club MVP.",
    "You knew it all along! {loser} should bow to your literary wisdom.",
    "Perfect prediction! Use that dollar to bookmark your next victory.",
    "Reading between the lines paid off! {loser} is $1 poorer now.",
]

# Fun phrases for loser notifications
LOSER_PHRASES = [
    "💸 Dollar Bet Result",
    "📉 Bet Lost! Time to Pay Up",
    "🎲 Betting Luck Ran Out",
    "🤦‍♂️ So Close, Yet So Far",
    "📚 The Book Had Other Plans",
    "💔 Your Prediction Missed",
    "🪙 Time to Part With a Dollar",
    "🧾 Invoice: One Dollar Due",
    "🎭 Plot Twist! You Lost the Bet",
    "🙈 Oops! Bet Lost",
]

# Fun phrases for the loser notification body
LOSER_BODY_PHRASES = [
    'The bet about "{description}" didn\'t go your way. {winner} is waiting for that dollar!',
    'Time to pay up! {winner} was right about "{description}".',
    'Your prediction was bold, but {winner} had the winning take on "{description}".',
    "Better luck next time! {winner} is doing a victory dance right now.",
    "The book had other plans! {winner} is now $1 richer.",
    "Your literary prediction skills need work. {winner} sends their regards.",
    "Now you owe {winner} a whole dollar. Don't spend it all at once, {winner}!",
    "{winner} saw that plot twist coming! Your dollar awaits its new owner.",
    "Looks like {winner} was the better book psychic this time.",
    "That's the price of a daring prediction! {winner} is waiting for payment.",
]


@login_required
def resolve_dollar_bet(request, bet_id):
    """View for admins to resolve a dollar bet (mark as won/lost/inconclusive)"""
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
        resolution = request.POST.get("resolution")

        if resolution == "inconclusive":
            # Mark as inconclusive
            bet.mark_inconclusive(request.user)

            # Get notification message based on whether there was a counter-bet
            notification_message = ""
            if bet.counter_description:
                notification_message = f"Neither prediction ('{bet.description[:30]}...' nor '{bet.counter_description[:30]}...') was correct. The bet was ruled inconclusive by {request.user.username}."
            else:
                notification_message = f"The bet about \"{bet.description[:50]}{'...' if len(bet.description) > 50 else ''}\" was ruled inconclusive by {request.user.username}."

            # Notify both participants
            for participant in [bet.proposer, bet.accepter]:
                send_push_notification(
                    user=participant,
                    title="Dollar Bet Ruled Inconclusive",
                    body=notification_message,
                    url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
                    icon=book.cover_image_url if book.cover_image_url else None,
                    notification_type="bet_resolved",
                )
        else:
            # Regular win/loss resolution
            winner_id = request.POST.get("winner")
            if not winner_id:
                return JsonResponse(
                    {"error": "Winner must be specified for win/loss resolution"},
                    status=400,
                )

            winner = get_object_or_404(User, id=winner_id)

            # Validate winner is either proposer or accepter
            if winner not in [bet.proposer, bet.accepter]:
                return JsonResponse({"error": "Invalid winner"}, status=400)

            # If not already set as 'finished' level, upgrade spoiler level
            if bet.spoiler_level != "finished":
                bet.spoiler_level = "finished"

            bet.resolve(winner, request.user)

            # Determine the loser
            loser = bet.accepter if winner == bet.proposer else bet.proposer

            # Get truncated description for notifications
            winning_prediction = (
                bet.description if winner == bet.proposer else bet.counter_description
            )
            truncated_prediction = winning_prediction[:50] + (
                "..." if len(winning_prediction) > 50 else ""
            )

            # Select random fun phrases for winner
            winner_title = random.choice(WINNER_PHRASES)
            winner_body_template = random.choice(WINNER_BODY_PHRASES)
            winner_body = winner_body_template.format(
                loser=loser.username, description=truncated_prediction
            )

            # Select random fun phrases for loser
            loser_title = random.choice(LOSER_PHRASES)
            loser_body_template = random.choice(LOSER_BODY_PHRASES)
            loser_body = loser_body_template.format(
                winner=winner.username, description=truncated_prediction
            )

            # Notify the winner
            send_push_notification(
                user=winner,
                title=winner_title,
                body=winner_body,
                url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
                icon=book.cover_image_url if book.cover_image_url else None,
                notification_type="bet_resolved",
            )

            # Notify the loser
            send_push_notification(
                user=loser,
                title=loser_title,
                body=loser_body,
                url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
                icon=book.cover_image_url if book.cover_image_url else None,
                notification_type="bet_resolved",
            )

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
        counter_description = request.POST.get("counter_description", "").strip()
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
            counter_description=counter_description if counter_description else None,
            amount=1.00,
            status="accepted",
            spoiler_level=spoiler_level,
        )

        # Customize notification message based on counter bet presence
        notification_body = ""
        if counter_description:
            notification_body = f'An admin has added you to a bet: "{description[:30]}..." vs counter-bet: "{counter_description[:30]}..." in {group.name}.'
        else:
            notification_body = f"An admin has added you to a bet about \"{description[:50]}{'...' if len(description) > 50 else ''}\" in {group.name}."

        # Notify both participants that they've been added to a bet
        for participant in [proposer, accepter]:
            send_push_notification(
                user=participant,
                title="You've Been Added to a Dollar Bet",
                body=notification_body,
                url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
                icon=book.cover_image_url if book.cover_image_url else None,
                notification_type="bet_added_to",
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


@login_required
def delete_dollar_bet(request, bet_id):
    """View to delete an open bet (replacing cancel)"""
    bet = get_object_or_404(DollarBet, id=bet_id)
    group = bet.group
    book = bet.book

    # Check if dollar bets are enabled for this group
    if not group.is_dollar_bets_enabled():
        return HttpResponseForbidden("Dollar bets are not enabled for this group")

    # Only proposer can delete their bet (if open) or an admin
    if bet.status != "open":
        return HttpResponseForbidden("Only open bets can be deleted")

    if request.user != bet.proposer and not group.is_admin(request.user):
        return HttpResponseForbidden(
            "Only the proposer or an admin can delete this bet"
        )

    # Perform the deletion
    bet.delete()

    # Redirect to book detail with bets tab active
    return redirect(f"/books/{book.id}/?tab=bets")
