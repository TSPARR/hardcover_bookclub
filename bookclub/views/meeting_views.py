from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.contrib.auth.decorators import login_required
from django.db.models import Max
from django.utils.dateparse import parse_datetime
from django.utils import timezone

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


def _has_meeting_perm(user, codename: str) -> bool:
    """Check Django model permission for Meeting, e.g., 'bookclub.add_meeting'."""
    app_label = Meeting._meta.app_label
    return user.has_perm(f"{app_label}.{codename}")


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
    - description (str, optional)
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

    # Require either group admin or Django 'add_meeting' permission
    if not (_is_group_admin(request.user, group) or _has_meeting_perm(request.user, "add_meeting")):
        return JsonResponse({"error": "Forbidden: admin or add_meeting permission required."}, status=403)

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
    description = request.POST.get("description", "").strip()

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
        description=description,
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
        # public visibility removed
        "place": meeting.place,
        "description": meeting.description,
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
    # Require either group admin or Django 'change_meeting' permission
    if not (_is_group_admin(request.user, group) or _has_meeting_perm(request.user, "change_meeting")):
        return JsonResponse({"error": "Forbidden: admin or change_meeting permission required."}, status=403)

    # Check if Title is Empty
    title = request.POST.get("title")
    if title is not None:
        meeting.title = title.strip()

    # Check if place is empty
    place = request.POST.get("place")
    if place is not None:
        meeting.place = place.strip()

    # Description field
    description = request.POST.get("description")
    if description is not None:
        meeting.description = description.strip()

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
        end_str = end_raw.strip() if isinstance(end_raw, str) else end_raw
        if end_str == "":
            # Treat empty string as clearing the end_time
            meeting.end_time = None
        else:
            end_dt = parse_datetime(end_str)
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
        # public visibility removed
        "place": meeting.place,
        "description": meeting.description,
    })


@login_required
@require_POST
def delete_meeting(request, meeting_id: int):
    """Minimal admin-guarded delete endpoint."""
    meeting = Meeting.objects.filter(pk=meeting_id).first()
    if not meeting:
        return JsonResponse({"error": "Meeting not found."}, status=404)

    # Require either group admin or Django 'delete_meeting' permission
    if not (_is_group_admin(request.user, meeting.group) or _has_meeting_perm(request.user, "delete_meeting")):
        return JsonResponse({"error": "Forbidden: admin or delete_meeting permission required."}, status=403)

    meeting.delete()

    accept_json = request.headers.get("Accept", "").lower().find("application/json") != -1
    if accept_json:
        return JsonResponse({"status": "deleted", "id": meeting_id})
    from django.shortcuts import redirect
    return redirect("group_detail", group_id=meeting.group_id)


@login_required
@require_GET
def meeting_detail(request, meeting_id: int):
    """Render a meeting details page with core info and attendance."""
    meeting = Meeting.objects.select_related("group", "book", "created_by").filter(pk=meeting_id).first()
    if not meeting:
        return JsonResponse({"error": "Meeting not found."}, status=404)

    group = meeting.group
    # Visibility: allow either membership OR Django Meeting model permissions
    can_manage = (
        _is_group_admin(request.user, group)
        or _has_meeting_perm(request.user, "add_meeting")
        or _has_meeting_perm(request.user, "change_meeting")
        or _has_meeting_perm(request.user, "delete_meeting")
    )
    if not group.is_member(request.user) and not can_manage:
        return JsonResponse({"error": "Forbidden: membership or meeting permission required."}, status=403)

    # Attendance summary
    attendance_qs = meeting.attendance.select_related("user")
    yes_attendees = [a.user for a in attendance_qs.filter(rsvp_status="yes")]
    # Treat 'maybe' as not attending for logic moving forward
    no_attendees = [a.user for a in attendance_qs.filter(rsvp_status__in=["no", "maybe"])]
    # Users who did not vote: members without any attendance record
    voted_user_ids = set(attendance_qs.values_list("user_id", flat=True))
    did_not_vote_users = list(group.members.exclude(id__in=voted_user_ids))

    # Determine whether current user has joined
    user_joined = attendance_qs.filter(user=request.user, rsvp_status="yes").exists()

    from django.shortcuts import render
    is_past = meeting.start_time <= timezone.now()
    return render(
        request,
        "bookclub/meeting_detail.html",
        {
            "meeting": meeting,
            "group": group,
            "book": meeting.book,
            "yes_attendees": yes_attendees,
            "no_attendees": no_attendees,
            "did_not_vote_users": did_not_vote_users,
            "user_joined": user_joined,
            # Treat users with meeting perms as "admin" for UI controls
            "is_admin": can_manage,
            "is_past": is_past,
        },
    )

    


@login_required
@require_POST
def join_meeting(request, meeting_id: int):
    """Allow a group member to RSVP 'yes' to a meeting."""
    meeting = Meeting.objects.filter(pk=meeting_id).first()
    if not meeting:
        return JsonResponse({"error": "Meeting not found."}, status=404)

    # Disallow joining past meetings
    if meeting.start_time <= timezone.now():
        return JsonResponse({"error": "Meeting has already occurred."}, status=400)

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

    # Disallow leaving past meetings
    if meeting.start_time <= timezone.now():
        return JsonResponse({"error": "Meeting has already occurred."}, status=400)

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
