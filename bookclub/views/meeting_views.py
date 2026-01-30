from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.contrib.auth.decorators import login_required
from django.db.models import Max
from django.utils.dateparse import parse_datetime

from bookclub.models import BookGroup, Book, Meeting, MeetingAttendance


@require_GET
def next_meeting_info(request):
    """
    Minimal endpoint: returns the next meeting number and a suggested title
    for a given scope (group + optional book).

    Query params:
    - group: int (required)
    - book: int (optional)

    Response JSON:
    { "next_number": int, "suggested_title": str }

    Future improvements:
    - Validate user permissions to view group/books.
    - Include user's timezone or group timezone for time-related suggestions.
    - Consider reservation of meeting numbers under high concurrency if UX needs it.
    """
    group_id = request.GET.get("group")
    if not group_id:
        return JsonResponse({"error": "Missing 'group' parameter."}, status=400)

    group = BookGroup.objects.filter(pk=group_id).first()
    if not group:
        return JsonResponse({"error": "Group not found."}, status=404)

    book_id = request.GET.get("book")
    base_title = group.name

    if book_id:
        book = Book.objects.filter(pk=book_id).first()
        if not book:
            return JsonResponse({"error": "Book not found."}, status=404)
        # If Book has a group relation, validate it; otherwise skip.
        if hasattr(book, "group_id") and book.group_id != group.id:
            return JsonResponse({"error": "Book must belong to the group."}, status=400)
        qs = Meeting.objects.filter(group_id=group.id, book_id=book.id)
        base_title = getattr(book, "title", base_title)
    else:
        qs = Meeting.objects.filter(group_id=group.id, book__isnull=True)

    last = qs.aggregate(m=Max("meeting_number"))
    next_n = (last.get("m") or 0) + 1
    suggested = f"{base_title} {ordinal(next_n)} Meeting"

    return JsonResponse({
        "next_number": next_n,
        "suggested_title": suggested,
    })


def ordinal(n: int) -> str:
    # Simple ordinal helper; mirrors common English rules.
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _is_group_admin(user, group: BookGroup) -> bool:
    return bool(group.admins.filter(pk=user.pk).exists())


@login_required
@require_POST
def create_meeting(request):
    """
    Minimal admin-guarded creation endpoint.
    Expects form-encoded or JSON body with keys:
    - group (int, required)
    - book (int, optional)
    - title (str, optional)
    - start_time (ISO8601, required)
    - end_time (ISO8601, optional)
    - place (str, optional)
    - is_public (bool-like, optional)

    Future improvements:
    - Full serializer/DRF usage with validation and error codes.
    - Enforce book-group relation via explicit foreign key if available.
    - CSRF integration for SPA/AJAX; currently relies on Django defaults.
    """
    data = request.POST or request.body
    group_id = request.POST.get("group") or request.GET.get("group")
    if not group_id:
        return JsonResponse({"error": "Missing 'group'."}, status=400)

    group = BookGroup.objects.filter(pk=group_id).first()
    if not group:
        return JsonResponse({"error": "Group not found."}, status=404)

    if not _is_group_admin(request.user, group):
        return JsonResponse({"error": "Forbidden: admin required."}, status=403)

    book_id = request.POST.get("book")
    book = None
    if book_id:
        book = Book.objects.filter(pk=book_id).first()
        if not book:
            return JsonResponse({"error": "Book not found."}, status=404)
        if hasattr(book, "group_id") and book.group_id != group.id:
            return JsonResponse({"error": "Book must belong to the group."}, status=400)

    title = request.POST.get("title", "").strip()
    place = request.POST.get("place", "").strip()
    is_public_raw = request.POST.get("is_public", "false").lower()
    is_public = is_public_raw in ("true", "1", "yes")

    start_raw = request.POST.get("start_time")
    if not start_raw:
        return JsonResponse({"error": "Missing 'start_time'."}, status=400)
    start_dt = parse_datetime(start_raw)
    if not start_dt:
        return JsonResponse({"error": "Invalid 'start_time' format."}, status=400)

    end_raw = request.POST.get("end_time")
    end_dt = parse_datetime(end_raw) if end_raw else None
    if end_dt and end_dt <= start_dt:
        return JsonResponse({"error": "'end_time' must be after 'start_time'."}, status=400)

    meeting = Meeting(
        group=group,
        book=book,
        title=title,
        place=place,
        is_public=is_public,
        start_time=start_dt,
        end_time=end_dt,
        created_by=request.user,
    )
    try:
        meeting.save()
    except Exception as e:
        return JsonResponse({"error": "Failed to create meeting.", "detail": str(e)}, status=400)

    return JsonResponse({
        "id": meeting.id,
        "title": getattr(meeting, "display_title", meeting.title),
        "group": meeting.group_id,
        "book": meeting.book_id,
        "start_time": meeting.start_time.isoformat(),
        "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
        "is_public": meeting.is_public,
        "place": meeting.place,
    }, status=201)


@login_required
@require_POST
def update_meeting(request, meeting_id: int):
    """
    Minimal admin-guarded update endpoint.
    Allows updating title, start_time, end_time, place, is_public.

    Future improvements:
    - Restrict scope changes (book/group) if model invariants require.
    - Use DRF serializers with partial updates.
    """
    meeting = Meeting.objects.filter(pk=meeting_id).first()
    if not meeting:
        return JsonResponse({"error": "Meeting not found."}, status=404)

    # Check if user is group admin
    group = meeting.group
    if not _is_group_admin(request.user, group):
        return JsonResponse({"error": "Forbidden: admin required."}, status=403)

    # Check if Title is Empty
    title = request.POST.get("title")
    if title is not None:
        meeting.title = title.strip()

    # Check if place is empty
    place = request.POST.get("place")
    if place is not None:
        meeting.place = place.strip()

    # Check is_public field
    is_public_raw = request.POST.get("is_public")
    if is_public_raw is not None:
        meeting.is_public = is_public_raw.lower() in ("true", "1", "yes")

    # Check start_time field Format
    start_raw = request.POST.get("start_time")
    if start_raw is not None:
        start_dt = parse_datetime(start_raw)
        if not start_dt:
            return JsonResponse({"error": "Invalid 'start_time' format."}, status=400)
        meeting.start_time = start_dt
    
    # Check end_time field Format and logic
    end_raw = request.POST.get("end_time")
    if end_raw is not None:
        end_dt = parse_datetime(end_raw)
        if not end_dt:
            return JsonResponse({"error": "Invalid 'end_time' format."}, status=400)
        if meeting.start_time and end_dt <= meeting.start_time:
            return JsonResponse({"error": "'end_time' must be after 'start_time'."}, status=400)
        meeting.end_time = end_dt

    try:
        meeting.save()
    except Exception as e:
        return JsonResponse({"error": "Failed to update meeting.", "detail": str(e)}, status=400)

    return JsonResponse({
        "id": meeting.id,
        "title": getattr(meeting, "display_title", meeting.title),
        "group": meeting.group_id,
        "book": meeting.book_id,
        "start_time": meeting.start_time.isoformat(),
        "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
        "is_public": meeting.is_public,
        "place": meeting.place,
    })


@login_required
@require_POST
def delete_meeting(request, meeting_id: int):
    """Minimal admin-guarded delete endpoint."""
    meeting = Meeting.objects.filter(pk=meeting_id).first()
    if not meeting:
        return JsonResponse({"error": "Meeting not found."}, status=404)

    if not _is_group_admin(request.user, meeting.group):
        return JsonResponse({"error": "Forbidden: admin required."}, status=403)

    meeting.delete()
    return JsonResponse({"status": "deleted", "id": meeting_id})


@login_required
@require_POST
def join_meeting(request, meeting_id: int):
    """Allow a group member to RSVP 'yes' to a meeting."""
    meeting = Meeting.objects.filter(pk=meeting_id).first()
    if not meeting:
        return JsonResponse({"error": "Meeting not found."}, status=404)

    group = meeting.group
    # User must be a member of the group to join
    if not group.is_member(request.user):
        return JsonResponse({"error": "Forbidden: membership required."}, status=403)

    attendance, _created = MeetingAttendance.objects.get_or_create(
        meeting=meeting,
        user=request.user,
        defaults={"rsvp_status": "yes"},
    )
    if attendance.rsvp_status != "yes":
        attendance.rsvp_status = "yes"
        attendance.save(update_fields=["rsvp_status"])

    # Support both AJAX and regular form POSTs
    accept_json = request.headers.get("Accept", "").lower().find("application/json") != -1
    if accept_json:
        return JsonResponse({
            "status": "joined",
            "meeting": meeting.id,
            "group": group.id,
            "rsvp_status": attendance.rsvp_status,
        })

    # Fallback: redirect to the group's detail page
    from django.shortcuts import redirect
    return redirect("group_detail", group_id=group.id)

@login_required
@require_POST
def leave_meeting(request, meeting_id: int):
    """Allow a group member to leave a meeting (RSVP 'no')."""
    meeting = Meeting.objects.filter(pk=meeting_id).first()
    if not meeting:
        return JsonResponse({"error": "Meeting not found."}, status=404)

    group = meeting.group
    # User must be a member of the group
    if not group.is_member(request.user):
        return JsonResponse({"error": "Forbidden: membership required."}, status=403)

    # Update RSVP to 'no' if an attendance record exists
    attendance = MeetingAttendance.objects.filter(meeting=meeting, user=request.user).first()
    if attendance:
        if attendance.rsvp_status != "no":
            attendance.rsvp_status = "no"
            attendance.save(update_fields=["rsvp_status"])
    # If no attendance record, there's nothing to change; treat as success

    accept_json = request.headers.get("Accept", "").lower().find("application/json") != -1
    if accept_json:
        return JsonResponse({
            "status": "left",
            "meeting": meeting.id,
            "group": group.id,
            "rsvp_status": "no",
        })

    from django.shortcuts import redirect
    return redirect("group_detail", group_id=group.id)
