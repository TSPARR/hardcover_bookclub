import random

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone

from ..models import Book, BookGroup, DollarBet, BetParticipant, User
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

    # Create breadcrumb items
    breadcrumb_items = [
        {"url": reverse("home"), "title": "Home"},
        {"url": reverse("group_detail", args=[group.id]), "title": group.name},
        {
            "url": reverse("book_detail", args=[book.id]),
            "title": book.title.split(":")[0].strip(),
        },
        {"url": "#", "title": "Dollar Bets"},
    ]

    return render(
        request,
        "bookclub/dollar_bets_list.html",
        {
            "book": book,
            "group": group,
            "bets": bets,
            "is_admin": group.is_admin(request.user),
            "breadcrumb_items": breadcrumb_items,
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

    # Check if the book is active or the user is an admin
    if not book.is_active and not group.is_admin(request.user):
        messages.warning(
            request, "Dollar bets can only be created for the active book. "
        )
        return redirect("book_detail", book_id=book.id)

    # Create breadcrumb items
    breadcrumb_items = [
        {"url": reverse("home"), "title": "Home"},
        {"url": reverse("group_detail", args=[group.id]), "title": group.name},
        {
            "url": reverse("book_detail", args=[book.id]),
            "title": book.title.split(":")[0].strip(),
        },
        {"url": reverse("dollar_bets_list", args=[book.id]), "title": "Dollar Bets"},
        {"url": "#", "title": "Create Bet"},
    ]

    if request.method == "POST":
        bet_type = request.POST.get("bet_type", "two_party")
        spoiler_level = request.POST.get("spoiler_level", "halfway")

        if bet_type == "multi_party":
            # Multi-party bet creation
            question = request.POST.get("question", "").strip()
            my_prediction = request.POST.get("my_prediction", "").strip()
            min_participants = request.POST.get("min_participants", "2")
            max_participants = request.POST.get("max_participants", "").strip()

            if not question:
                return JsonResponse({"error": "Question is required"}, status=400)

            # Regular users must participate with their prediction
            if not my_prediction:
                return JsonResponse(
                    {"error": "Your prediction is required"}, status=400
                )

            try:
                min_participants = int(min_participants)
                if min_participants < 2:
                    return JsonResponse(
                        {"error": "Minimum participants must be at least 2"}, status=400
                    )
            except ValueError:
                return JsonResponse(
                    {"error": "Invalid minimum participants"}, status=400
                )

            max_participants_int = None
            if max_participants:
                try:
                    max_participants_int = int(max_participants)
                    if max_participants_int < min_participants:
                        return JsonResponse(
                            {"error": "Maximum participants must be >= minimum"},
                            status=400,
                        )
                except ValueError:
                    return JsonResponse(
                        {"error": "Invalid maximum participants"}, status=400
                    )

            # Create the bet
            bet = DollarBet.objects.create(
                book=book,
                group=group,
                bet_type="multi_party",
                question=question,
                creator=request.user,
                min_participants=min_participants,
                max_participants=max_participants_int,
                amount=1.00,
                spoiler_level=spoiler_level,
            )

            # Create participant record for creator if they provided a prediction
            if my_prediction:
                BetParticipant.objects.create(
                    bet=bet, user=request.user, prediction=my_prediction
                )

            # Send notifications to all group members (except the creator)
            for member in group.members.all():
                if member != request.user:
                    send_push_notification(
                        user=member,
                        title=f"New Multi-Party Bet in {group.name}",
                        body=f"{request.user.username} created: \"{question[:50]}{'...' if len(question) > 50 else ''}\"",
                        url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
                        icon=book.cover_image_url if book.cover_image_url else None,
                        notification_type="new_dollar_bets",
                    )

        else:
            # Two-party bet creation (legacy)
            description = request.POST.get("description")

            if not description:
                return JsonResponse({"error": "Description is required"}, status=400)

            bet = DollarBet.objects.create(
                book=book,
                group=group,
                bet_type="two_party",
                creator=request.user,
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
            "breadcrumb_items": breadcrumb_items,
        },
    )


@login_required
def join_dollar_bet(request, bet_id):
    """Allow users to join a multi-party bet with their prediction"""
    bet = get_object_or_404(DollarBet, id=bet_id)
    group = bet.group
    book = bet.book

    # Check if dollar bets are enabled for this group
    if not group.is_dollar_bets_enabled():
        return HttpResponseForbidden("Dollar bets are not enabled for this group")

    # Check if user is a member of the group
    if not group.is_member(request.user):
        return HttpResponseForbidden("You must be a group member to join")

    # Validation
    if bet.bet_type != "multi_party":
        messages.error(request, "Only multi-party bets can be joined")
        return redirect(f"/books/{book.id}/?tab=bets")

    if not bet.can_accept_participants():
        messages.error(request, "This bet is no longer accepting participants")
        return redirect(f"/books/{book.id}/?tab=bets")

    if bet.participants.filter(user=request.user).exists():
        messages.error(request, "You've already joined this bet")
        return redirect(f"/books/{book.id}/?tab=bets")

    # Create breadcrumb items
    breadcrumb_items = [
        {"url": reverse("home"), "title": "Home"},
        {"url": reverse("group_detail", args=[group.id]), "title": group.name},
        {
            "url": reverse("book_detail", args=[book.id]),
            "title": book.title.split(":")[0].strip(),
        },
        {"url": reverse("dollar_bets_list", args=[book.id]), "title": "Dollar Bets"},
        {"url": "#", "title": "Join Bet"},
    ]

    if request.method == "POST":
        prediction = request.POST.get("prediction", "").strip()
        if not prediction:
            messages.error(request, "Prediction is required")
            return render(
                request,
                "bookclub/join_dollar_bet.html",
                {
                    "bet": bet,
                    "existing_participants": bet.participants.all(),
                    "book": book,
                    "group": group,
                    "breadcrumb_items": breadcrumb_items,
                },
            )

        # Create participant
        BetParticipant.objects.create(bet=bet, user=request.user, prediction=prediction)

        # Send notifications to creator and existing participants
        notification_users = set([bet.creator])  # Always notify creator
        for participant in bet.participants.exclude(user=request.user):
            notification_users.add(participant.user)

        for user in notification_users:
            if user and user != request.user:  # Don't notify self
                send_push_notification(
                    user=user,
                    title="Someone Joined Your Bet!",
                    body=f"{request.user.username} joined: \"{prediction[:50]}{'...' if len(prediction) > 50 else ''}\"",
                    url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
                    icon=book.cover_image_url if book.cover_image_url else None,
                    notification_type="bet_participant_joined",
                )

        messages.success(request, "You've joined the bet!")
        return redirect(f"/books/{book.id}/?tab=bets")

    context = {
        "bet": bet,
        "existing_participants": bet.participants.all(),
        "book": book,
        "group": group,
        "breadcrumb_items": breadcrumb_items,
    }
    return render(request, "bookclub/join_dollar_bet.html", context)


@login_required
def close_betting(request, bet_id):
    """Admin manually closes betting on a multi-party bet"""
    bet = get_object_or_404(DollarBet, id=bet_id)
    group = bet.group
    book = bet.book

    # Validation
    if not group.is_admin(request.user):
        return HttpResponseForbidden("Only admins can close betting")

    if bet.bet_type != "multi_party":
        messages.error(request, "Only multi-party bets can be manually closed")
        return redirect(f"/books/{book.id}/?tab=bets")

    if bet.status != "open":
        messages.error(request, "Only open bets can be closed")
        return redirect(f"/books/{book.id}/?tab=bets")

    # Check min participants
    if bet.participant_count < bet.min_participants:
        messages.error(
            request,
            f"Need at least {bet.min_participants} participants to close betting. "
            f"Currently have {bet.participant_count}.",
        )
        return redirect(f"/books/{book.id}/?tab=bets")

    # Close betting
    bet.status = "active"
    bet.save()

    # Notify all participants
    for participant in bet.participants.all():
        send_push_notification(
            user=participant.user,
            title="Bet Activated!",
            body=f"Betting closed for \"{bet.question[:50]}{'...' if len(bet.question) > 50 else ''}\". Good luck!",
            url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
            icon=book.cover_image_url if book.cover_image_url else None,
            notification_type="bet_activated",
        )

    messages.success(
        request, "Betting closed. Bet is now active and ready for resolution."
    )
    return redirect(f"/books/{book.id}/?tab=bets")


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

    # Create breadcrumb items
    breadcrumb_items = [
        {"url": reverse("home"), "title": "Home"},
        {"url": reverse("group_detail", args=[group.id]), "title": group.name},
        {
            "url": reverse("book_detail", args=[book.id]),
            "title": book.title.split(":")[0].strip(),
        },
        {"url": reverse("dollar_bets_list", args=[book.id]), "title": "Dollar Bets"},
        {"url": "#", "title": "Accept Bet"},
    ]

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
            "breadcrumb_items": breadcrumb_items,
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

    # Check status - support both old "accepted" and new "active" status
    if bet.status not in ["accepted", "active"]:
        return HttpResponseForbidden("Only active/accepted bets can be resolved")

    # Create breadcrumb items
    breadcrumb_items = [
        {"url": reverse("home"), "title": "Home"},
        {"url": reverse("group_detail", args=[group.id]), "title": group.name},
        {
            "url": reverse("book_detail", args=[book.id]),
            "title": book.title.split(":")[0].strip(),
        },
        {"url": reverse("dollar_bets_list", args=[book.id]), "title": "Dollar Bets"},
        {"url": "#", "title": "Resolve Bet"},
    ]

    if request.method == "POST":
        resolution = request.POST.get("resolution")

        if resolution == "inconclusive":
            # Mark as inconclusive
            bet.status = "resolved_inconclusive"
            bet.resolved_at = timezone.now()
            bet.resolved_by = request.user
            bet.save()

            # Get notification message
            if bet.bet_type == "multi_party":
                notification_message = f"The bet \"{bet.question[:50]}{'...' if len(bet.question) > 50 else ''}\" was ruled inconclusive by {request.user.username}."
                # Notify all participants
                for participant in bet.participants.all():
                    send_push_notification(
                        user=participant.user,
                        title="Dollar Bet Ruled Inconclusive",
                        body=notification_message,
                        url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
                        icon=book.cover_image_url if book.cover_image_url else None,
                        notification_type="bet_resolved",
                    )
            else:
                # Two-party bet
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

            if bet.bet_type == "multi_party":
                # Multi-party: validate winner is a participant
                participant = bet.participants.filter(user=winner).first()
                if not participant:
                    return JsonResponse(
                        {"error": "Winner must be a participant"}, status=400
                    )

                # Resolve the bet
                bet.winner = winner
                bet.status = "resolved_winner"
                bet.resolved_at = timezone.now()
                bet.resolved_by = request.user
                if bet.spoiler_level != "finished":
                    bet.spoiler_level = "finished"
                bet.save()

                # Notify all participants
                for p in bet.participants.all():
                    if p.user == winner:
                        # Winner notification
                        send_push_notification(
                            user=p.user,
                            title=random.choice(WINNER_PHRASES),
                            body=f"You won ${bet.total_pot}! Your prediction was correct: \"{p.prediction[:50]}{'...' if len(p.prediction) > 50 else ''}\"",
                            url=request.build_absolute_uri(
                                f"/books/{book.id}/?tab=bets"
                            ),
                            icon=book.cover_image_url if book.cover_image_url else None,
                            notification_type="bet_resolved",
                        )
                    else:
                        # Loser notification
                        send_push_notification(
                            user=p.user,
                            title=random.choice(LOSER_PHRASES),
                            body=f"{winner.username} won ${bet.total_pot} with the correct prediction!",
                            url=request.build_absolute_uri(
                                f"/books/{book.id}/?tab=bets"
                            ),
                            icon=book.cover_image_url if book.cover_image_url else None,
                            notification_type="bet_resolved",
                        )
            else:
                # Two-party: validate winner is either proposer or accepter
                if winner not in [bet.proposer, bet.accepter]:
                    return JsonResponse({"error": "Invalid winner"}, status=400)

                # If not already set as 'finished' level, upgrade spoiler level
                if bet.spoiler_level != "finished":
                    bet.spoiler_level = "finished"

                # Resolve the bet with new status
                bet.winner = winner
                bet.status = "resolved_winner"
                bet.resolved_at = timezone.now()
                bet.resolved_by = request.user
                bet.save()

                # Determine the loser
                loser = bet.accepter if winner == bet.proposer else bet.proposer

                # Get truncated description for notifications
                winning_prediction = (
                    bet.description
                    if winner == bet.proposer
                    else (bet.counter_description or bet.description)
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

    context = {
        "bet": bet,
        "book": book,
        "group": group,
        "breadcrumb_items": breadcrumb_items,
    }

    return render(request, "bookclub/resolve_dollar_bet.html", context)


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

    # Create breadcrumb items
    breadcrumb_items = [
        {"url": reverse("home"), "title": "Home"},
        {"url": reverse("group_detail", args=[group.id]), "title": group.name},
        {
            "url": reverse("book_detail", args=[book.id]),
            "title": book.title.split(":")[0].strip(),
        },
        {"url": reverse("dollar_bets_list", args=[book.id]), "title": "Dollar Bets"},
        {"url": "#", "title": "Admin Create Bet"},
    ]

    if request.method == "POST":
        bet_type = request.POST.get("bet_type", "two_party")
        spoiler_level = request.POST.get("spoiler_level", "halfway")

        if bet_type == "multi_party":
            # Multi-party bet creation (admin can optionally participate)
            question = request.POST.get("question", "").strip()
            my_prediction = request.POST.get("my_prediction", "").strip()
            min_participants = request.POST.get("min_participants", "2")
            max_participants = request.POST.get("max_participants", "").strip()

            if not question:
                messages.error(request, "Question is required")
                return redirect("admin_create_dollar_bet", book_id=book.id)

            try:
                min_participants = int(min_participants)
                if min_participants < 2:
                    messages.error(request, "Minimum participants must be at least 2")
                    return redirect("admin_create_dollar_bet", book_id=book.id)
            except ValueError:
                messages.error(request, "Invalid minimum participants")
                return redirect("admin_create_dollar_bet", book_id=book.id)

            max_participants_int = None
            if max_participants:
                try:
                    max_participants_int = int(max_participants)
                    if max_participants_int < min_participants:
                        messages.error(
                            request, "Maximum participants must be >= minimum"
                        )
                        return redirect("admin_create_dollar_bet", book_id=book.id)
                except ValueError:
                    messages.error(request, "Invalid maximum participants")
                    return redirect("admin_create_dollar_bet", book_id=book.id)

            # Create the bet
            bet = DollarBet.objects.create(
                book=book,
                group=group,
                bet_type="multi_party",
                question=question,
                creator=request.user,
                min_participants=min_participants,
                max_participants=max_participants_int,
                amount=1.00,
                spoiler_level=spoiler_level,
            )

            # Admin can optionally participate
            if my_prediction:
                BetParticipant.objects.create(
                    bet=bet, user=request.user, prediction=my_prediction
                )

            # Notify all group members
            for member in group.members.all():
                if member != request.user:
                    send_push_notification(
                        user=member,
                        title=f"Admin Created Multi-Party Bet in {group.name}",
                        body=f"New bet: \"{question[:50]}{'...' if len(question) > 50 else ''}\"",
                        url=request.build_absolute_uri(f"/books/{book.id}/?tab=bets"),
                        icon=book.cover_image_url if book.cover_image_url else None,
                        notification_type="new_dollar_bets",
                    )

            messages.success(request, "Multi-party dollar bet created successfully")
            return redirect(f"/books/{book.id}/?tab=bets")

        else:
            # Two-party bet creation (existing logic)
            description = request.POST.get("description")
            counter_description = request.POST.get("counter_description", "").strip()
            proposer_id = request.POST.get("proposer")
            accepter_id = request.POST.get("accepter")

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
                bet_type="two_party",
                creator=request.user,
                proposer=proposer,
                accepter=accepter,
                description=description,
                counter_description=(
                    counter_description if counter_description else None
                ),
                amount=1.00,
                status="active",  # Use new status
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
            "breadcrumb_items": breadcrumb_items,
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
