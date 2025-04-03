"""
Attribution analytics views for tracking book picks in groups.
"""

import logging
from collections import defaultdict

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect, render

from ..models import BookGroup, MemberStartingPoint

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
    attribution_counts = defaultdict(int)  # Define this here
    collective_count = 0
    unattributed_count = 0

    # Track the rotation pattern and sequence
    book_sequence = []
    previous_picker = None
    streak_count = 0

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

        # Store as a tuple for compatibility with existing functions
        book_sequence.append((picker_id, book, streak_count))

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
            "rotation_analysis": rotation_analysis,
            "fairness_metrics": fairness_metrics,
            "next_picker": next_picker,
        },
    )


def analyze_rotation(book_sequence, members, group):
    """Analyze rotation patterns using admin-specified starting points."""
    if not book_sequence:
        return {"has_pattern": False, "message": "No books have been added yet."}

    # Get member starting points
    starting_points = MemberStartingPoint.objects.filter(group=group).select_related(
        "member", "starting_book"
    )

    # Create lookup dictionaries
    starting_book_indexes = {}
    books_by_id = {item[1].id: idx for idx, item in enumerate(book_sequence)}

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
        books_since_eligible = len(book_sequence) - starting_idx

        # Count picks since eligible
        picks_since_eligible = sum(
            1
            for idx, (picker_id, _, _) in enumerate(book_sequence)
            if idx >= starting_idx and picker_id == member.id
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
