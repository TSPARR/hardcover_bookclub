import re
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models import Count
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django_cryptography.fields import encrypt


class BookGroup(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    members = models.ManyToManyField(User, related_name="book_groups")
    admins = models.ManyToManyField(User, related_name="administered_groups")
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    enable_dollar_bets = models.BooleanField(
        default=False,
        help_text="Enable $1 betting for predictions about books in this group",
    )

    def __str__(self):
        return self.name

    def is_admin(self, user):
        """Check if a user is an admin of this group."""
        return self.admins.filter(id=user.id).exists()

    def is_member(self, user):
        """Check if a user is a member of this group."""
        return self.members.filter(id=user.id).exists()

    def is_dollar_bets_enabled(self):
        """Check if dollar bets are enabled for this group"""
        # Both the site-wide setting and the group setting must be enabled
        return settings.ENABLE_DOLLAR_BETS and self.enable_dollar_bets


class Book(models.Model):
    title = models.CharField(max_length=300)
    author = models.CharField(max_length=200)
    hardcover_id = models.CharField(max_length=50, unique=True)  # ID from Hardcover API
    cover_image_url = models.URLField(blank=True)
    url = models.URLField(blank=True)
    description = models.TextField(blank=True)
    group = models.ForeignKey(BookGroup, on_delete=models.CASCADE, related_name="books")
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=False)  # New field for active status
    display_order = models.PositiveIntegerField(default=0)
    picked_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="book_picks",
    )
    is_collective_pick = models.BooleanField(default=False)

    # Hardcover metadata
    pages = models.IntegerField(null=True, blank=True)
    audio_seconds = models.IntegerField(null=True, blank=True)

    # Kavita metadata
    kavita_url = models.URLField(blank=True)

    # Plex Metadata
    plex_url = models.URLField(blank=True)

    class Meta:
        ordering = ["display_order", "id"]

    def __str__(self):
        return f"{self.title} by {self.author}"

    def set_active(self):
        """Set this book as the active book for its group and deactivate others"""
        # Start a transaction to ensure consistency
        with transaction.atomic():
            # First, deactivate all books in this group
            self.group.books.all().update(is_active=False)
            # Then activate this book
            self.is_active = True
            self.save(update_fields=["is_active"])


class BookEdition(models.Model):
    """Stores information about a specific edition of a book"""

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="editions")
    hardcover_edition_id = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=300)
    isbn = models.CharField(max_length=20, blank=True, null=True)
    isbn13 = models.CharField(max_length=20, blank=True, null=True)
    cover_image_url = models.URLField(blank=True)
    publisher = models.CharField(max_length=200, blank=True)
    publication_date = models.DateField(blank=True, null=True)
    pages = models.IntegerField(null=True, blank=True)
    audio_seconds = models.IntegerField(null=True, blank=True)
    reading_format = models.CharField(max_length=20, blank=True)
    reading_format_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    is_kavita_promoted = models.BooleanField(default=False)
    is_plex_promoted = models.BooleanField(default=False)

    def __str__(self):
        format_str = f" ({self.reading_format})" if self.reading_format else ""
        return f"{self.title}{format_str}"

    def save(self, *args, **kwargs):
        # Ensure only one edition is marked as promoted for each service per book
        if self.is_kavita_promoted:
            BookEdition.objects.filter(book=self.book, is_kavita_promoted=True).exclude(
                id=self.id
            ).update(is_kavita_promoted=False)

        if self.is_plex_promoted:
            BookEdition.objects.filter(book=self.book, is_plex_promoted=True).exclude(
                id=self.id
            ).update(is_plex_promoted=False)

        super().save(*args, **kwargs)

    @property
    def audio_duration_formatted(self):
        """Return a human-readable audio duration"""
        if not self.audio_seconds:
            return None
        hours = self.audio_seconds // 3600
        minutes = (self.audio_seconds % 3600) // 60
        return f"{hours}h {minutes}m"


class Comment(models.Model):
    PROGRESS_TYPE_CHOICES = [
        ("page", "Page Number"),
        ("audio", "Audio Timestamp"),
        ("percent", "Percentage"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="book_comments"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="comments")
    text = models.TextField()
    progress_type = models.CharField(max_length=10, choices=PROGRESS_TYPE_CHOICES)
    progress_value = models.CharField(
        max_length=20
    )  # Can be a page number, timestamp (HH:MM:SS), or percentage
    created_at = models.DateTimeField(auto_now_add=True)
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies"
    )

    # Hardcover reading progress data
    hardcover_started_at = models.DateTimeField(null=True, blank=True)
    hardcover_finished_at = models.DateTimeField(null=True, blank=True)
    hardcover_percent = models.FloatField(null=True, blank=True)
    hardcover_current_page = models.IntegerField(null=True, blank=True)
    hardcover_current_position = models.IntegerField(
        null=True, blank=True
    )  # Audio position in seconds
    hardcover_reading_format = models.CharField(max_length=10, null=True, blank=True)
    hardcover_edition_id = models.CharField(max_length=50, null=True, blank=True)

    def __str__(self):
        return f"Comment by {self.user.username} on {self.book.title}"

    # Method to check if this is a top-level comment
    def is_parent(self):
        return self.parent is None

    def get_replies(self):
        if not hasattr(self, "replies"):
            # Field might not exist if model was recently updated
            return Comment.objects.none()
        return self.replies.all().order_by("created_at")

    def get_reactions_summary(self):
        """Get a summary of reactions for this comment"""
        reactions = self.reactions.values("reaction").annotate(count=Count("id"))
        return {r["reaction"]: r["count"] for r in reactions}

    def get_users_for_reaction(self):
        """Get users who reacted with each reaction type"""
        reaction_types = self.reactions.values_list("reaction", flat=True).distinct()
        result = {}
        for reaction in reaction_types:
            result[reaction] = self.reactions.filter(reaction=reaction).values_list(
                "user", flat=True
            )
        return result


class CommentReaction(models.Model):
    REACTION_CHOICES = [
        ("👍", "Thumbs Up"),
        ("❤️", "Heart"),
        ("😂", "Laugh"),
        ("😮", "Wow"),
        ("😢", "Sad"),
        ("🎉", "Celebrate"),
        ("💡", "Idea"),
        ("📚", "Book"),
    ]

    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, related_name="reactions"
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    reaction = models.CharField(max_length=10, choices=REACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ensure a user can only have one reaction type per comment
        unique_together = ("comment", "user", "reaction")


class UserBookProgress(models.Model):
    """Track user's reading progress for a specific book."""

    PROGRESS_TYPE_CHOICES = [
        ("page", "Page Number"),
        ("audio", "Audio Timestamp"),
        ("percent", "Percentage"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="book_progress"
    )
    book = models.ForeignKey(
        Book, on_delete=models.CASCADE, related_name="user_progress"
    )
    # Add this field to reference the specific edition
    edition = models.ForeignKey(
        BookEdition,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_progress",
    )
    progress_type = models.CharField(max_length=10, choices=PROGRESS_TYPE_CHOICES)
    progress_value = models.CharField(
        max_length=20
    )  # Can be page number, timestamp, or percentage
    normalized_progress = models.FloatField(
        default=0
    )  # Normalized progress as a value between 0-100
    last_updated = models.DateTimeField(auto_now=True)

    # Hardcover reading progress data
    hardcover_started_at = models.DateTimeField(null=True, blank=True)
    hardcover_finished_at = models.DateTimeField(null=True, blank=True)
    hardcover_percent = models.FloatField(null=True, blank=True)
    hardcover_current_page = models.IntegerField(null=True, blank=True)
    hardcover_current_position = models.IntegerField(
        null=True, blank=True
    )  # Audio position in seconds
    hardcover_reading_format = models.CharField(max_length=10, null=True, blank=True)
    hardcover_edition_id = models.CharField(max_length=50, null=True, blank=True)
    hardcover_read_id = models.CharField(max_length=50, null=True, blank=True)

    hardcover_rating = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
    )
    local_rating = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
    )

    @property
    def effective_rating(self):
        if self.hardcover_rating is not None:
            return self.hardcover_rating
        return self.local_rating

    class Meta:
        unique_together = (
            "user",
            "book",
        )  # Each user can have only one progress entry per book

    def __str__(self):
        edition_str = f" ({self.edition})" if self.edition else ""
        return f"{self.user.username}'s progress on {self.book.title}{edition_str}"

    def save(self, *args, **kwargs):
        # Calculate normalized progress before saving
        self.normalized_progress = self._calculate_normalized_progress()
        super().save(*args, **kwargs)

    def _calculate_normalized_progress(self):
        """Convert different progress types to a value between 0 and 100."""
        # Only use hardcover_percent if it's not None
        if self.hardcover_percent is not None:
            # Ensure hardcover_percent is capped at 100
            return min(float(self.hardcover_percent), 100.0)

        if self.progress_type == "percent":
            try:
                # Extract numeric part from percentage string (e.g., "75%" -> 75)
                percent_value = float(self.progress_value.replace("%", ""))
                # Cap at 100%
                return min(percent_value, 100.0)
            except (ValueError, AttributeError):
                return 0

        elif self.progress_type == "page":
            # If we have book pages and current page, calculate percentage
            try:
                page = int(self.progress_value)
                # First check if we have edition pages
                if self.edition and self.edition.pages and self.edition.pages > 0:
                    return min((page / self.edition.pages) * 100, 100.0)
                # Fall back to book pages
                elif self.book.pages and self.book.pages > 0:
                    return min((page / self.book.pages) * 100, 100.0)
                return 0  # Can't normalize without total pages
            except (ValueError, AttributeError, ZeroDivisionError):
                return 0

        elif self.progress_type == "audio":
            # For audio, convert to a percentage if we have total audio duration
            if self.hardcover_current_position:
                # First check if we have edition audio duration
                if (
                    self.edition
                    and self.edition.audio_seconds
                    and self.edition.audio_seconds > 0
                ):
                    return min(
                        (self.hardcover_current_position / self.edition.audio_seconds)
                        * 100,
                        100.0,
                    )
                # Fall back to book audio duration
                elif self.book.audio_seconds and self.book.audio_seconds > 0:
                    return min(
                        (self.hardcover_current_position / self.book.audio_seconds)
                        * 100,
                        100.0,
                    )

            # Try to parse timestamps like "2h 45m" or "1:30:00"
            try:
                total_seconds = 0

                # Try HH:MM:SS format
                colon_pattern = r"^(\d+):([0-5]?\d):([0-5]?\d)$"
                colon_match = re.match(colon_pattern, self.progress_value)

                if colon_match:
                    hours = int(colon_match.group(1))
                    minutes = int(colon_match.group(2))
                    seconds = int(colon_match.group(3))
                    total_seconds = (hours * 3600) + (minutes * 60) + seconds

                # Try Xh Ym format
                elif "h" in self.progress_value or "m" in self.progress_value:
                    time_pattern = r"^(?:(\d+)h\s*)?(?:(\d+)m)?$"
                    time_match = re.match(time_pattern, self.progress_value)

                    if time_match:
                        hours = int(time_match.group(1) or 0)
                        minutes = int(time_match.group(2) or 0)
                        total_seconds = (hours * 3600) + (minutes * 60)

                if total_seconds > 0:
                    # First check if we have edition audio duration
                    if (
                        self.edition
                        and self.edition.audio_seconds
                        and self.edition.audio_seconds > 0
                    ):
                        return min(
                            (total_seconds / self.edition.audio_seconds) * 100, 100.0
                        )
                    # Fall back to book audio duration
                    elif self.book.audio_seconds and self.book.audio_seconds > 0:
                        return min(
                            (total_seconds / self.book.audio_seconds) * 100, 100.0
                        )
            except (ValueError, IndexError, ZeroDivisionError, AttributeError):
                pass

            return 0  # Default for audio if we can't calculate

        return 0  # Default fallback


class GroupInvitation(models.Model):
    """Model for storing group invitations"""

    # The group this invitation is for
    group = models.ForeignKey(
        BookGroup, on_delete=models.CASCADE, related_name="invitations"
    )

    # The admin who created the invitation
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="created_invitations"
    )

    # Unique code for the invitation
    code = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    # When the invitation was created
    created_at = models.DateTimeField(auto_now_add=True)

    # When the invitation expires (default: 7 days after creation)
    expires_at = models.DateTimeField()

    # If the invitation has been used
    is_used = models.BooleanField(default=False)

    # If the invitation has been revoked by an admin
    is_revoked = models.BooleanField(default=False)

    # Optional email address this invitation was sent to
    email = models.EmailField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invitation to {self.group.name} by {self.created_by.username}"

    def save(self, *args, **kwargs):
        # Set expiration date if not already set
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        """Check if the invitation is still valid"""
        now = timezone.now()
        return not self.is_used and not self.is_revoked and now < self.expires_at

    @property
    def days_until_expiry(self):
        """Return the number of days until this invitation expires"""
        if self.is_used or self.is_revoked:
            return 0

        now = timezone.now()
        if now > self.expires_at:
            return 0

        delta = self.expires_at - now
        return delta.days


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    hardcover_api_key = encrypt(models.TextField(blank=True, null=True))
    can_create_groups = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username}'s profile"


@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    else:
        instance.profile.save()


class MemberStartingPoint(models.Model):
    """Tracks when a member officially joined the rotation."""

    group = models.ForeignKey(BookGroup, on_delete=models.CASCADE)
    member = models.ForeignKey(User, on_delete=models.CASCADE)
    starting_book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        help_text="The first book this member was eligible to pick",
    )
    notes = models.TextField(blank=True, null=True)
    set_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="set_starting_points"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "member")
        ordering = ["group", "starting_book__display_order"]

    def __str__(self):
        return f"{self.member.username} in {self.group.name} starting with '{self.starting_book.title}'"


class DollarBet(models.Model):
    BET_STATUS_CHOICES = [
        ("open", "Open"),
        ("accepted", "Accepted"),
        ("won", "Won"),
        ("lost", "Lost"),
        ("canceled", "Canceled"),
    ]

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="dollar_bets")
    group = models.ForeignKey(
        BookGroup, on_delete=models.CASCADE, related_name="dollar_bets"
    )

    proposer = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="proposed_dollar_bets"
    )
    accepter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="accepted_dollar_bets",
        null=True,
        blank=True,
    )

    description = models.TextField(
        help_text="What the bet is about (e.g., 'Character X will die')"
    )
    amount = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=1.00,
        validators=[MinValueValidator(1.00), MaxValueValidator(1.00)],
    )

    status = models.CharField(max_length=10, choices=BET_STATUS_CHOICES, default="open")
    winner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="won_dollar_bets",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_dollar_bets",
    )

    def __str__(self):
        return f"${self.amount} bet on {self.book.title}: {self.description[:30]}..."

    def resolve(self, winner_user, resolved_by_user):
        """Resolve the bet by setting a winner"""
        # Ensure the bet is in 'accepted' status
        if self.status != "accepted":
            raise ValueError("Only accepted bets can be resolved")

        # Ensure the winner is either the proposer or accepter
        if winner_user not in [self.proposer, self.accepter]:
            raise ValueError("Winner must be either the proposer or accepter")

        self.winner = winner_user
        self.status = "won" if winner_user == self.proposer else "lost"
        self.resolved_at = timezone.now()
        self.resolved_by = resolved_by_user
        self.save()

    def accept(self, user):
        """Accept an open bet"""
        if self.status != "open" and self.accepter is None:
            raise ValueError("Only open bets can be accepted")

        if self.proposer == user:
            raise ValueError("Cannot accept your own bet")

        self.accepter = user
        self.status = "accepted"
        self.save()

    def cancel(self):
        """Cancel a bet (only if still open)"""
        if self.status != "open":
            raise ValueError("Only open bets can be canceled")

        self.status = "canceled"
        self.save()
