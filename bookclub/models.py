from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
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
    description = models.TextField(blank=True)
    group = models.ForeignKey(BookGroup, on_delete=models.CASCADE, related_name="books")
    created_at = models.DateTimeField(auto_now_add=True)

    # Book metadata from Hardcover
    pages = models.IntegerField(null=True, blank=True)
    audio_seconds = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.title} by {self.author}"


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
        return f"{self.user.username}'s progress on {self.book.title}"

    def save(self, *args, **kwargs):
        # Calculate normalized progress before saving
        self.normalized_progress = self._calculate_normalized_progress()
        super().save(*args, **kwargs)

    def _calculate_normalized_progress(self):
        """Convert different progress types to a value between 0 and 100."""
        if self.hardcover_percent is not None:
            return self.hardcover_percent

        if self.progress_type == "percent":
            try:
                # Extract numeric part from percentage string (e.g., "75%" -> 75)
                return float(self.progress_value.replace("%", ""))
            except (ValueError, AttributeError):
                return 0

        elif self.progress_type == "page":
            # If we have book pages and current page, calculate percentage
            try:
                page = int(self.progress_value)
                if self.book.pages:
                    return (page / self.book.pages) * 100
                return 0  # Can't normalize without total pages
            except (ValueError, AttributeError):
                return 0

        elif self.progress_type == "audio":
            # For audio, convert to a percentage if we have total audio duration
            if self.hardcover_current_position and self.book.audio_seconds:
                return (self.hardcover_current_position / self.book.audio_seconds) * 100

            # Try to parse timestamps like "2h 45m"
            try:
                if "h" in self.progress_value and "m" in self.progress_value:
                    parts = self.progress_value.split()
                    hours = int(parts[0].replace("h", ""))
                    minutes = int(parts[1].replace("m", ""))
                    total_seconds = (hours * 3600) + (minutes * 60)

                    if self.book.audio_seconds:
                        return (total_seconds / self.book.audio_seconds) * 100
            except (ValueError, IndexError):
                pass

            return 0  # Default for audio if we can't calculate

        return 0  # Default fallback


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
