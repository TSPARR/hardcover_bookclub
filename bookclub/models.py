import uuid
from datetime import timedelta

from django.contrib.auth.models import User
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

    def __str__(self):
        return self.name

    def is_admin(self, user):
        """Check if a user is an admin of this group."""
        return self.admins.filter(id=user.id).exists()

    def is_member(self, user):
        """Check if a user is a member of this group."""
        return self.members.filter(id=user.id).exists()


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

    # Book metadata from Hardcover
    pages = models.IntegerField(null=True, blank=True)
    audio_seconds = models.IntegerField(null=True, blank=True)

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

    def __str__(self):
        format_str = f" ({self.reading_format})" if self.reading_format else ""
        return f"{self.title}{format_str}"

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

            # Try to parse timestamps like "2h 45m"
            try:
                if "h" in self.progress_value and "m" in self.progress_value:
                    parts = self.progress_value.split()
                    hours = int(parts[0].replace("h", ""))
                    minutes = int(parts[1].replace("m", ""))
                    total_seconds = (hours * 3600) + (minutes * 60)

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
            except (ValueError, IndexError, ZeroDivisionError):
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
