"""
Attribution analytics views for tracking book picks in groups.
"""

import logging
from collections import defaultdict
from statistics import mean, median

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from ..models import (
    Book,
    BookEdition,
    BookGroup,
    DollarBet,
    MemberStartingPoint,
    UserBookProgress,
)

logger = logging.getLogger(__name__)


@login_required
def attribution_analytics(request, group_id):
    """View for displaying analytics about book attributions in a group."""
    group = get_object_or_404(BookGroup, id=group_id)

    # Check if user is a member of this group
    if not group.is_member(request.user):
        messages.error(request, "You are not a member of this group.")
        return redirect("home")

    # Get all books for this group, ordered by display_order
    books = group.books.all().order_by("display_order", "created_at")

    # Get group members for attribution analysis
    members = group.members.all()

    # Initialize counters
    attribution_counts = defaultdict(int)
    collective_count = 0
    unattributed_count = 0

    # Track the rotation pattern and sequence
    book_sequence = []
    previous_picker = None
    streak_count = 0

    # Get all user ratings for books in this group
    book_ratings = {}
    rating_distribution = [0, 0, 0, 0, 0]  # Count of 1-5 star ratings
    member_ratings = defaultdict(list)  # For tracking each member's ratings

    for book in books:
        # Get all progress entries for this book
        progress_entries = UserBookProgress.objects.filter(book=book)

        # Collect all valid ratings (prefer hardcover_rating, fall back to local_rating)
        ratings = []
        for entry in progress_entries:
            rating = None
            if entry.hardcover_rating is not None:
                rating = entry.hardcover_rating
            elif entry.local_rating is not None:
                rating = entry.local_rating

            if rating is not None:
                float_rating = float(rating)
                ratings.append(float_rating)

                # Add to distribution count
                star_index = min(int(float_rating) - 1, 4)  # 0-4 index for 1-5 stars
                rating_distribution[star_index] += 1

                # Add to member ratings
                member_ratings[entry.user.id].append(float_rating)

        # Calculate aggregate ratings if we have any
        if ratings:
            book_ratings[book.id] = {
                "avg_rating": mean(ratings),
                "median_rating": median(ratings),
                "count": len(ratings),
                "ratings": ratings,  # Include all ratings for distribution analysis
            }

        # Add individual user ratings to the book_ratings
        user_ratings = {}
        for entry in progress_entries:
            user_id = entry.user.id
            rating = None

            # Use the same rating preference as above
            if entry.hardcover_rating is not None:
                rating = entry.hardcover_rating
            elif entry.local_rating is not None:
                rating = entry.local_rating

            if rating is not None:
                # Also include any comments if they exist
                comment = None
                if hasattr(entry, "comment") and entry.comment:
                    comment = entry.comment
                elif hasattr(entry, "hardcover_review") and entry.hardcover_review:
                    comment = entry.hardcover_review

                # Add rating object with optional comment
                if comment:
                    user_ratings[user_id] = {"value": float(rating), "comment": comment}
                else:
                    user_ratings[user_id] = {"value": float(rating)}

        # Add to book ratings if we have any ratings
        if ratings:
            book_ratings[book.id]["user_ratings"] = user_ratings

    for book in books:
        if book.is_collective_pick:
            picker_id = "collective"
        elif book.picked_by:
            picker_id = book.picked_by.id
        else:
            picker_id = None

        # Calculate streak
        if previous_picker == picker_id:
            streak_count += 1
        else:
            streak_count = 1
            previous_picker = picker_id

        # Get rating data for this book
        rating_data = book_ratings.get(book.id, None)

        # Store as a tuple for compatibility with existing functions
        book_sequence.append((picker_id, book, streak_count, rating_data))

        # Count attributions
        if book.is_collective_pick:
            collective_count += 1
        elif book.picked_by:
            attribution_counts[book.picked_by.id] += 1
        else:
            unattributed_count += 1

    # Prepare member attribution data
    member_stats = []
    for member in members:
        member_stats.append(
            {
                "user": member,
                "count": attribution_counts.get(member.id, 0),
                "is_admin": group.is_admin(member),
            }
        )

    # Sort by count (descending) and then by username
    member_stats.sort(key=lambda x: (-x["count"], x["user"].username))

    # Analyze rotation pattern
    rotation_analysis = analyze_rotation(book_sequence, members, group)

    # Calculate pick fairness metric
    fair_shares = calculate_fair_share(
        attribution_counts, rotation_analysis["participation_stats"]
    )

    fairness_metrics = []
    for member in members:
        count = attribution_counts.get(member.id, 0)
        fair_share = fair_shares.get(member.id, 0)

        # Calculate deviation with more balanced approach
        deviation = count - fair_share

        # Prevent division by zero and handle small fair share values
        deviation_percent = (
            (deviation / max(fair_share, 0.1) * 100) if fair_share > 0 else 0
        )

        fairness_metrics.append(
            {
                "user": member,
                "count": count,
                "fair_share": fair_share,
                "deviation": deviation,
                "deviation_percent": deviation_percent,
            }
        )

    # Annotate after creating the metrics
    fairness_metrics = annotate_fairness_metrics(fairness_metrics)

    # Sort by absolute deviation to highlight most significant disparities
    fairness_metrics.sort(key=lambda x: abs(x["deviation"]), reverse=True)

    # Get next in rotation based on previous picks
    next_picker = suggest_next_picker(book_sequence, members, group)

    # Calculate overall group rating statistics
    all_ratings = []
    for rating_data in book_ratings.values():
        all_ratings.extend(rating_data["ratings"])

    group_rating_stats = None
    if all_ratings:
        group_rating_stats = {
            "avg_rating": mean(all_ratings),
            "median_rating": median(all_ratings),
            "count": len(all_ratings),
            "books_rated": len(book_ratings),
            "distribution": rating_distribution,
        }

    # Calculate member rating statistics
    member_rating_stats = []
    for member_id, ratings in member_ratings.items():
        if ratings:
            member = next((m for m in members if m.id == member_id), None)
            if member:
                member_rating_stats.append(
                    {
                        "user": member,
                        "avg_rating": mean(ratings),
                        "count": len(ratings),
                    }
                )

    # Sort member rating stats by count (descending)
    member_rating_stats.sort(key=lambda x: (-x["count"], -x["avg_rating"]))

    # Sort books by average rating (descending)
    sorted_book_sequence = sorted(
        book_sequence,
        key=lambda x: x[3]["avg_rating"] if x[3] and x[3]["count"] >= 2 else 0,
        reverse=True,
    )

    has_any_books = False
    for rating_group in sorted_book_sequence:
        if not isinstance(rating_group, (list, tuple)):
            continue

        for item in rating_group:
            if not isinstance(item, (list, tuple)) or len(item) < 4:
                continue

            try:
                _, _, _, rating_data = item
                if (
                    rating_data
                    and hasattr(rating_data, "count")
                    and rating_data.count >= 2
                ):
                    has_any_books = True
                    break
            except (ValueError, TypeError):
                continue

        if has_any_books:
            break

    # Add calculation of dollar bet statistics
    dollar_bet_stats, dollar_bet_summary, dollar_rivalries = calculate_dollar_bet_stats(
        group
    )

    # Add calculation of media statistics
    kavita_stats, plex_stats = calculate_media_stats(group)

    return render(
        request,
        "bookclub/attribution_analytics.html",
        {
            "group": group,
            "member_stats": member_stats,
            "collective_count": collective_count,
            "unattributed_count": unattributed_count,
            "total_books": books.count(),
            "book_sequence": book_sequence,
            "sorted_book_sequence": sorted_book_sequence,
            "has_any_books": has_any_books,
            "rotation_analysis": rotation_analysis,
            "fairness_metrics": fairness_metrics,
            "next_picker": next_picker,
            "group_rating_stats": group_rating_stats,
            "member_rating_stats": member_rating_stats,
            "rating_distribution": (
                rating_distribution if group_rating_stats else [0, 0, 0, 0, 0]
            ),
            "dollar_bet_stats": dollar_bet_stats,
            "dollar_bet_summary": dollar_bet_summary,
            "dollar_rivalries": dollar_rivalries,
            "kavita_stats": kavita_stats,
            "plex_stats": plex_stats,
        },
    )


def analyze_rotation(book_sequence, members, group):
    """Analyze rotation patterns using admin-specified starting points."""
    # Get member starting points
    starting_points = MemberStartingPoint.objects.filter(group=group).select_related(
        "member", "starting_book"
    )

    # Create lookup dictionaries
    starting_book_indexes = {}
    books_by_id = (
        {item[1].id: idx for idx, item in enumerate(book_sequence)}
        if book_sequence
        else {}
    )

    # For each member, find when they became eligible
    for sp in starting_points:
        if sp.starting_book.id in books_by_id:
            starting_book_indexes[sp.member.id] = books_by_id[sp.starting_book.id]

    # Track participation since eligibility
    participation_stats = {}
    for member in members:
        # Default to the beginning if no starting point set
        starting_idx = starting_book_indexes.get(member.id, 0)

        # Count books since eligible
        books_since_eligible = len(book_sequence) - starting_idx if book_sequence else 0

        # Count picks since eligible
        picks_since_eligible = (
            sum(
                1
                for idx, (picker_id, _, _, _) in enumerate(
                    book_sequence
                )  # Updated for 4-tuple
                if idx >= starting_idx and picker_id == member.id
            )
            if book_sequence
            else 0
        )

        # Calculate participation rate
        participation_rate = (
            picks_since_eligible / books_since_eligible
            if books_since_eligible > 0
            else 0
        )

        participation_stats[member.id] = {
            "eligible_since_book": starting_idx,
            "books_since_eligible": books_since_eligible,
            "picks_since_eligible": picks_since_eligible,
            "participation_rate": participation_rate,
            "starting_book": (
                book_sequence[starting_idx][1]
                if starting_idx < len(book_sequence)
                else None
            ),
        }

    if not book_sequence:
        return {
            "has_pattern": False,
            "message": "No books have been added yet.",
            "participation_stats": participation_stats,
            "rotations": [],
            "rotation_count": 0,
            "avg_balance": 0,
            "avg_coverage": 0,
            "non_participating": list({member.id for member in members}),
        }

    # Extract just the picker IDs for pattern analysis (excluding collective/group picks)
    picker_sequence = [
        item[0]
        for item in book_sequence
        if item[0] is not None and item[0] != "collective"
    ]

    # If not enough picks to analyze
    if len(picker_sequence) < 3:
        return {
            "has_pattern": False,
            "message": "Not enough individually attributed books to analyze rotation pattern.",
            "participation_stats": participation_stats,
            "rotations": [],
            "rotation_count": 0,
            "avg_balance": 0,
            "avg_coverage": 0,
            "non_participating": list(
                {member.id for member in members} - set(picker_sequence)
            ),
        }

    # Get all member IDs for reference
    member_ids = {member.id for member in members}

    # Find all the unique pickers that have participated
    unique_pickers = set(picker_sequence)

    # APPROACH: Detect natural groupings with balanced sizes
    min_rotation_size = max(
        3, min(len(members) // 2, 4)
    )  # Minimum size for a meaningful rotation
    max_rotation_size = max(
        len(members) + 2, min(len(members) * 2, 10)
    )  # Allow some flexibility but cap the max

    rotations = []
    current_rotation = []
    active_members = set()

    for picker_id in picker_sequence:
        # Add this picker to current rotation
        current_rotation.append(picker_id)
        active_members.add(picker_id)

        # Check if we should end this rotation
        rotation_size = len(current_rotation)
        unique_members_in_rotation = len(active_members)

        # End rotation conditions:
        # 1. We've hit max size
        # 2. We've seen most members AND rotation is at least minimum size
        # 3. We're seeing repeats of the same member in this rotation

        should_end_rotation = (
            rotation_size >= max_rotation_size
            or (
                unique_members_in_rotation >= len(unique_pickers) * 0.7
                and rotation_size >= min_rotation_size
            )
            or (
                picker_id in set(current_rotation[:-1])
                and rotation_size >= min_rotation_size
            )
        )

        if should_end_rotation:
            rotations.append(current_rotation.copy())
            current_rotation = []
            active_members = set()

    # Add the final rotation if it meets minimum size requirement
    if len(current_rotation) >= min_rotation_size:
        rotations.append(current_rotation)
    # If not, add remaining picks to the last rotation if possible
    elif rotations and current_rotation:
        rotations[-1].extend(current_rotation)

    # Check if all members participate in rotations
    all_participants = set()
    for rotation in rotations:
        all_participants.update(rotation)

    non_participating = member_ids - all_participants

    # Analyze the quality of each rotation
    rotation_qualities = []
    for rotation in rotations:
        # Get unique members in this rotation
        rotation_members = set(rotation)

        # Calculate balance score (unique members / total picks)
        balance_score = len(rotation_members) / len(rotation)

        # Calculate coverage (what percentage of all members participated)
        coverage_score = len(rotation_members) / len(members) if members else 0

        # Detect sub-patterns (members who tend to pick in sequence)
        sub_patterns = detect_sub_patterns(rotation)

        rotation_qualities.append(
            {
                "rotation": rotation,
                "balance": balance_score,
                "coverage": coverage_score,
                "sub_patterns": sub_patterns,
                "is_clean": balance_score > 0.9,  # "Clean" means almost no repeats
            }
        )

    # Calculate average metrics
    avg_balance = (
        sum(r["balance"] for r in rotation_qualities) / len(rotation_qualities)
        if rotation_qualities
        else 0
    )
    avg_coverage = (
        sum(r["coverage"] for r in rotation_qualities) / len(rotation_qualities)
        if rotation_qualities
        else 0
    )

    # Determine overall pattern quality
    has_pattern = len(rotations) > 1 and avg_balance > 0.6

    # Generate message based on findings
    if has_pattern and avg_balance > 0.9:
        message = "A regular rotation pattern was detected with members taking turns consistently."
    elif has_pattern and avg_balance > 0.7:
        message = "Book picks follow a fairly structured rotation pattern with occasional repeats."
    elif has_pattern:
        message = "Book picks follow a loose rotation pattern, with some members picking more frequently than others."
    else:
        message = "No clear rotation pattern was found. Book picks appear to be ad-hoc rather than following a set order."

    # Create a list of enhanced rotation objects
    enhanced_rotations = []
    for i, rotation in enumerate(rotations):
        enhanced_rotations.append(
            {
                "picks": rotation,
                "balance": rotation_qualities[i]["balance"],
                "coverage": rotation_qualities[i]["coverage"],
                "sub_patterns": rotation_qualities[i]["sub_patterns"],
                "is_clean": rotation_qualities[i]["is_clean"],
            }
        )

    return {
        "has_pattern": has_pattern,
        "rotations": enhanced_rotations,
        "rotation_count": len(enhanced_rotations),
        "avg_balance": avg_balance,
        "avg_coverage": avg_coverage,
        "participation_stats": participation_stats,
        "non_participating": list(non_participating),
        "message": message,
    }


def detect_sub_patterns(sequence):
    """Detect common sub-patterns in a sequence (pairs or triplets that repeat)."""
    if len(sequence) < 4:  # Need at least 4 items to find meaningful sub-patterns
        return {"pairs": [], "triplets": []}  # Return empty dict instead of empty list

    # Look for pairs that appear multiple times
    pairs = []
    for i in range(len(sequence) - 1):
        pair = (sequence[i], sequence[i + 1])
        # Check if this pair appears elsewhere in the sequence
        for j in range(i + 2, len(sequence) - 1):
            if sequence[j] == pair[0] and sequence[j + 1] == pair[1]:
                pairs.append(pair)
                break

    # Look for triplets if sequence is long enough
    triplets = []
    if len(sequence) >= 6:
        for i in range(len(sequence) - 2):
            triplet = (sequence[i], sequence[i + 1], sequence[i + 2])
            # Check if this triplet appears elsewhere
            for j in range(i + 3, len(sequence) - 2):
                if (
                    sequence[j] == triplet[0]
                    and sequence[j + 1] == triplet[1]
                    and sequence[j + 2] == triplet[2]
                ):
                    triplets.append(triplet)
                    break

    return {"pairs": pairs, "triplets": triplets}


def suggest_next_picker(book_sequence, members, group):
    """Suggest who should pick next based on fairness principles."""
    # If no books or members, can't suggest
    if not book_sequence or not members:
        return None

    # Get the most recent picker to avoid suggesting them again
    most_recent_picker_id = None
    for item in reversed(book_sequence):
        picker_id = item[0]
        if picker_id is not None and picker_id != "collective":
            most_recent_picker_id = picker_id
            break

    # Get all picker IDs (excluding group picks)
    picker_ids = [
        item[0]
        for item in book_sequence
        if item[0] is not None and item[0] != "collective"
    ]

    # If no individual picks yet, suggest a random admin
    if not picker_ids:
        admins = group.admins.all()
        if admins:
            return admins.first()
        return members.first()

    # Count picks per member
    pick_counts = defaultdict(int)
    for picker_id in picker_ids:
        pick_counts[picker_id] += 1

    # Map member IDs to user objects
    member_dict = {member.id: member for member in members}

    # Find members who have never picked
    never_picked = [member.id for member in members if member.id not in pick_counts]

    # Prioritize members who have never picked (and aren't the most recent picker)
    if never_picked:
        return member_dict.get(never_picked[0])

    # Find members who have picked the least
    min_picks = min(pick_counts.values()) if pick_counts else 0
    least_picked = [
        member_id
        for member_id, count in pick_counts.items()
        if count == min_picks and member_id != most_recent_picker_id
    ]

    # If we have members with the lowest pick count (excluding most recent picker)
    if least_picked:
        # Find which of these members picked least recently
        for item in reversed(book_sequence):
            picker_id = item[0]
            if picker_id in least_picked:
                # Return a different member with the same minimum count
                for alt_id in least_picked:
                    if alt_id != picker_id:
                        return member_dict.get(alt_id)
                # If only one member with min count, return them
                return member_dict.get(least_picked[0])

    # If all minimum-count members include the most recent picker, look for next tier
    next_min_picks = min(
        [
            count
            for member_id, count in pick_counts.items()
            if count > min_picks and member_id != most_recent_picker_id
        ],
        default=None,
    )

    if next_min_picks:
        next_tier_pickers = [
            member_id
            for member_id, count in pick_counts.items()
            if count == next_min_picks and member_id != most_recent_picker_id
        ]
        if next_tier_pickers:
            return member_dict.get(next_tier_pickers[0])

    # Default to first member who isn't the most recent picker
    for member in members:
        if member.id != most_recent_picker_id:
            return member

    # Ultimate fallback - first member
    return members.first()


def calculate_fair_share(attribution_counts, participation_stats):
    """
    Calculate a fair share that:
    - Considers total books picked
    - Normalizes for member eligibility
    - Provides a balanced perspective

    Args:
        attribution_counts (dict): Number of books picked by each member
        participation_stats (dict): Participation statistics including eligibility

    Returns:
        dict: Adjusted fair share for each member
    """
    # Total members
    total_members = len(participation_stats)

    # Total books picked
    total_picks = sum(attribution_counts.values())

    # Calculate total eligible books across all members
    total_eligible_books = sum(
        stats["books_since_eligible"] for stats in participation_stats.values()
    )

    # Base fair share calculation
    fair_shares = {}
    for member_id, stats in participation_stats.items():
        # Proportional eligibility
        member_eligible_proportion = (
            stats["books_since_eligible"] / total_eligible_books
            if total_eligible_books > 0
            else 0
        )

        # Expected picks based on eligibility
        expected_picks = total_picks * member_eligible_proportion

        fair_shares[member_id] = expected_picks

    return fair_shares


def annotate_fairness_metrics(fairness_metrics):
    """
    Add recommendation annotations to fairness metrics.

    Args:
        fairness_metrics (list): List of fairness metric dictionaries

    Returns:
        list: Annotated fairness metrics with recommendations
    """
    for metric in fairness_metrics:
        # Use absolute deviation percentage for threshold
        abs_deviation_percent = abs(metric["deviation_percent"])

        # More aggressive thresholds
        if abs_deviation_percent > 30:
            if metric["deviation"] > 0:
                metric["recommendation"] = "Slow down on book picks"
                metric["status"] = "over"
            else:
                metric["recommendation"] = "Pick more books to catch up"
                metric["status"] = "under"
        elif abs_deviation_percent > 15:
            if metric["deviation"] > 0:
                metric["recommendation"] = "Consider picking fewer books"
                metric["status"] = "over"
            else:
                metric["recommendation"] = "Consider picking more books"
                metric["status"] = "under"
        else:
            metric["recommendation"] = "Current pace looks good"
            metric["status"] = "balanced"

    return fairness_metrics


def calculate_dollar_bet_stats(group):
    """
    Calculate dollar bet statistics for a group.

    Args:
        group: The BookGroup object

    Returns:
        A tuple containing:
        - List of per-user dollar bet stats
        - Summary statistics for dollar bets
        - User rivalries data
    """
    # Skip if dollar bets are disabled
    if not group.is_dollar_bets_enabled():
        return [], {}, []

    # Get all dollar bets for this group that have been resolved
    bets = DollarBet.objects.filter(group=group)
    resolved_bets = bets.filter(status__in=["won", "lost"])

    # Statistics per user
    user_stats = defaultdict(
        lambda: {"won": 0, "lost": 0, "total": 0, "net": 0.0, "user": None}
    )

    # Track pairwise rivalries (who won money from whom)
    # Structure: {user_id: {opponent_id: net_amount}}
    rivalries = defaultdict(lambda: defaultdict(float))

    # Process resolved bets
    for bet in resolved_bets:
        # Update proposer stats
        user_stats[bet.proposer.id]["user"] = bet.proposer
        user_stats[bet.proposer.id]["total"] += 1

        if bet.status == "won":  # Proposer won
            user_stats[bet.proposer.id]["won"] += 1
            user_stats[bet.proposer.id]["net"] += float(bet.amount)

            # Update accepter stats
            if bet.accepter:
                user_stats[bet.accepter.id]["user"] = bet.accepter
                user_stats[bet.accepter.id]["lost"] += 1
                user_stats[bet.accepter.id]["total"] += 1
                user_stats[bet.accepter.id]["net"] -= float(bet.amount)

                # Update rivalries
                rivalries[bet.proposer.id][bet.accepter.id] += float(bet.amount)
                rivalries[bet.accepter.id][bet.proposer.id] -= float(bet.amount)

        elif bet.status == "lost":  # Proposer lost
            user_stats[bet.proposer.id]["lost"] += 1
            user_stats[bet.proposer.id]["net"] -= float(bet.amount)

            # Update accepter stats
            if bet.accepter:
                user_stats[bet.accepter.id]["user"] = bet.accepter
                user_stats[bet.accepter.id]["won"] += 1
                user_stats[bet.accepter.id]["total"] += 1
                user_stats[bet.accepter.id]["net"] += float(bet.amount)

                # Update rivalries
                rivalries[bet.proposer.id][bet.accepter.id] -= float(bet.amount)
                rivalries[bet.accepter.id][bet.proposer.id] += float(bet.amount)

    # Process proposer stats for open and accepted bets
    for bet in bets.filter(status__in=["open", "accepted"]):
        user_stats[bet.proposer.id]["user"] = bet.proposer
        user_stats[bet.proposer.id]["total"] += 1

        if bet.status == "accepted" and bet.accepter:
            user_stats[bet.accepter.id]["user"] = bet.accepter
            user_stats[bet.accepter.id]["total"] += 1

    # Convert to list and sort by net winnings
    user_stats_list = list(user_stats.values())
    user_stats_list.sort(key=lambda x: (x["net"], x["won"]), reverse=True)

    # Summary statistics
    summary = {
        "total_bets": bets.count(),
        "resolved_bets": resolved_bets.count(),
        "biggest_winner": None,
        "biggest_loser": None,
        "most_active": None,
        "most_profitable_rivalry": None,
    }

    # Find biggest winner and loser
    if user_stats_list:
        summary["biggest_winner"] = user_stats_list[0]  # First after sorting by net
        summary["biggest_loser"] = min(user_stats_list, key=lambda x: x["net"])
        summary["most_active"] = max(user_stats_list, key=lambda x: x["total"])

    # Process rivalries to find nemesis and cash cow for each user
    user_rivalries = []

    # Track most profitable rivalry overall
    most_profitable_amount = 0

    for user_id, opponents in rivalries.items():
        if not opponents:
            continue

        # Get user object
        user = user_stats[user_id]["user"]

        # Find the nemesis (person who took the most money)
        nemesis_id = None
        nemesis_loss = 0

        # Find the cash cow (person who gave the most money)
        cash_cow_id = None
        cash_cow_gain = 0

        for opponent_id, net_amount in opponents.items():
            if net_amount < 0 and abs(net_amount) > nemesis_loss:
                nemesis_id = opponent_id
                nemesis_loss = abs(net_amount)

            if net_amount > 0 and net_amount > cash_cow_gain:
                cash_cow_id = opponent_id
                cash_cow_gain = net_amount

                # Check if this is the most profitable rivalry overall
                if cash_cow_gain > most_profitable_amount:
                    most_profitable_amount = cash_cow_gain
                    summary["most_profitable_rivalry"] = {
                        "winner": user.username,
                        "loser": user_stats[opponent_id]["user"].username,
                        "amount": cash_cow_gain,
                    }

        # Add to rivalries list
        user_rivalries.append(
            {
                "user": user,
                "nemesis": user_stats[nemesis_id]["user"] if nemesis_id else None,
                "nemesis_loss": nemesis_loss if nemesis_loss > 0 else None,
                "cash_cow": user_stats[cash_cow_id]["user"] if cash_cow_id else None,
                "cash_cow_gain": cash_cow_gain if cash_cow_gain > 0 else None,
            }
        )

    # Sort rivalries by users with biggest cash cows (most profitable rivalries)
    user_rivalries.sort(
        key=lambda x: x["cash_cow_gain"] if x["cash_cow_gain"] else 0, reverse=True
    )

    return user_stats_list, summary, user_rivalries


def calculate_media_stats(group):
    """
    Calculate Kavita (page count) and Plex (listening time) statistics.

    Args:
        group: The BookGroup object

    Returns:
        A tuple containing:
        - Kavita statistics (page count, etc.)
        - Plex statistics (listening time, etc.)
    """
    # Initialize stats dictionaries
    kavita_stats = {
        "total_pages": 0,
        "avg_pages": 0,
        "longest_book": None,
        "shortest_book": None,
    }

    plex_stats = {
        "total_seconds": 0,
        "avg_seconds": 0,
        "total_time_formatted": "0h 0m",
        "avg_time_formatted": "0h 0m",
        "longest_book": None,
        "shortest_book": None,
    }

    # Get all books for this group
    books = Book.objects.filter(group=group)

    # Kavita Stats (if enabled)
    if settings.KAVITA_ENABLED:
        # Get books with Kavita editions
        kavita_books = []
        for book in books:
            # Try to find a Kavita-promoted edition
            kavita_edition = BookEdition.objects.filter(
                book=book, is_kavita_promoted=True
            ).first()

            if kavita_edition and kavita_edition.pages:
                book_info = {
                    "title": book.title,
                    "pages": kavita_edition.pages,
                    "edition": kavita_edition,
                }
                kavita_books.append(book_info)
            elif book.pages:  # Fallback to book pages if no Kavita edition
                book_info = {"title": book.title, "pages": book.pages, "edition": None}
                kavita_books.append(book_info)

        # Calculate stats if we have any books with page counts
        if kavita_books:
            kavita_stats["total_pages"] = sum(book["pages"] for book in kavita_books)
            kavita_stats["avg_pages"] = kavita_stats["total_pages"] / len(kavita_books)

            # Find longest and shortest books
            longest = max(kavita_books, key=lambda x: x["pages"])
            shortest = min(kavita_books, key=lambda x: x["pages"])

            kavita_stats["longest_book"] = longest
            kavita_stats["shortest_book"] = shortest

    # Plex Stats (if enabled)
    if settings.PLEX_ENABLED:
        # Get books with Plex editions
        plex_books = []
        for book in books:
            # Try to find a Plex-promoted edition
            plex_edition = BookEdition.objects.filter(
                book=book, is_plex_promoted=True
            ).first()

            if plex_edition and plex_edition.audio_seconds:
                book_info = {
                    "title": book.title,
                    "seconds": plex_edition.audio_seconds,
                    "duration": format_audio_duration(plex_edition.audio_seconds),
                    "edition": plex_edition,
                }
                plex_books.append(book_info)
            elif book.audio_seconds:  # Fallback to book audio_seconds
                book_info = {
                    "title": book.title,
                    "seconds": book.audio_seconds,
                    "duration": format_audio_duration(book.audio_seconds),
                    "edition": None,
                }
                plex_books.append(book_info)

        # Calculate stats if we have any books with audio durations
        if plex_books:
            plex_stats["total_seconds"] = sum(book["seconds"] for book in plex_books)
            plex_stats["avg_seconds"] = plex_stats["total_seconds"] / len(plex_books)

            # Format total and average listening time
            plex_stats["total_time_formatted"] = format_audio_duration(
                plex_stats["total_seconds"]
            )
            plex_stats["avg_time_formatted"] = format_audio_duration(
                plex_stats["avg_seconds"]
            )

            # Find longest and shortest audiobooks
            longest = max(plex_books, key=lambda x: x["seconds"])
            shortest = min(plex_books, key=lambda x: x["seconds"])

            plex_stats["longest_book"] = longest
            plex_stats["shortest_book"] = shortest

    return kavita_stats, plex_stats


def format_audio_duration(seconds):
    """
    Format audio duration in seconds to a human-readable format.

    Args:
        seconds: Duration in seconds

    Returns:
        Formatted string like "10h 45m" or "45m"
    """
    if not seconds:
        return "0h 0m"

    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)

    if hours > 0:
        return f"{hours}h {minutes}m"
    else:
        return f"{minutes}m"
