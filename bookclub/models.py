from django.contrib.auth.models import User
from django.db import models


class Group(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    members = models.ManyToManyField(User, related_name="book_groups")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Book(models.Model):
    title = models.CharField(max_length=300)
    author = models.CharField(max_length=200)
    hardcover_id = models.CharField(max_length=50, unique=True)  # ID from Hardcover API
    cover_image_url = models.URLField(blank=True)
    description = models.TextField(blank=True)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="books")
    created_at = models.DateTimeField(auto_now_add=True)

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

    def __str__(self):
        return f"Comment by {self.user.username} on {self.book.title}"
