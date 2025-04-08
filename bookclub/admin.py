from django.contrib import admin

from .models import (
    Book,
    BookEdition,
    BookGroup,
    Comment,
    CommentReaction,
    DollarBet,
    GroupInvitation,
    MemberStartingPoint,
    UserBookProgress,
    UserProfile,
)
from .views.book_utils import _get_progress_value_for_sorting


class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "can_create_groups", "enable_notifications")
    list_filter = ("can_create_groups", "enable_notifications")
    search_fields = ("user__username",)
    actions = ["grant_group_creation", "revoke_group_creation"]

    def grant_group_creation(self, request, queryset):
        updated = queryset.update(can_create_groups=True)
        self.message_user(
            request, f"Granted group creation permission to {updated} users."
        )

    grant_group_creation.short_description = "Grant group creation permission"

    def revoke_group_creation(self, request, queryset):
        updated = queryset.update(can_create_groups=False)
        self.message_user(
            request, f"Revoked group creation permission from {updated} users."
        )

    revoke_group_creation.short_description = "Revoke group creation permission"


class BookGroupAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "created_at",
        "is_public",
        "enable_dollar_bets",
        "member_count",
        "book_count",
    )
    list_filter = ("is_public", "enable_dollar_bets", "created_at")
    search_fields = ("name", "description")
    filter_horizontal = ("members", "admins")

    def member_count(self, obj):
        return obj.members.count()

    member_count.short_description = "Members"

    def book_count(self, obj):
        return obj.books.count()

    book_count.short_description = "Books"


class GroupInvitationAdmin(admin.ModelAdmin):
    list_display = (
        "group",
        "created_by",
        "created_at",
        "expires_at",
        "is_used",
        "is_revoked",
        "email",
    )
    list_filter = ("is_used", "is_revoked", "created_at", "expires_at")
    search_fields = ("group__name", "created_by__username", "email")
    readonly_fields = ("code",)


class BookAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "group", "is_active", "pages", "audio_seconds"]
    search_fields = ["title", "author"]
    list_filter = ["group", "is_active"]
    readonly_fields = ["hardcover_id", "created_at"]

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "title",
                    "author",
                    "description",
                    "group",
                    "is_active",
                    "display_order",
                    "picked_by",
                    "is_collective_pick",
                )
            },
        ),
        (
            "External Services",
            {
                "fields": (
                    "hardcover_id",
                    "cover_image_url",
                    "url",
                    "kavita_url",
                    "plex_url",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Metadata",
            {
                "fields": ("pages", "audio_seconds", "created_at"),
                "classes": ("collapse",),
            },
        ),
    )


class BookEditionAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "book",
        "reading_format",
        "pages",
        "audio_seconds",
        "is_kavita_promoted",
        "is_plex_promoted",
    ]
    list_filter = ["reading_format_id", "is_kavita_promoted", "is_plex_promoted"]
    search_fields = ["title", "book__title", "publisher"]
    raw_id_fields = ["book"]


class CommentAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "book",
        "progress_type",
        "progress_value",
        "get_normalized_progress",
        "created_at",
    ]
    list_filter = ["progress_type", "book", "user"]
    search_fields = ["text", "user__username", "book__title"]
    readonly_fields = ["created_at", "get_normalized_progress"]

    def get_normalized_progress(self, obj):
        """Calculate normalized progress for admin display"""
        return f"{_get_progress_value_for_sorting(obj):.1f}%"

    get_normalized_progress.short_description = "Normalized Progress"

    fieldsets = (
        (None, {"fields": ("user", "book", "text", "parent")}),
        (
            "Progress",
            {"fields": ("progress_type", "progress_value", "get_normalized_progress")},
        ),
        (
            "Hardcover Data",
            {
                "fields": (
                    "hardcover_started_at",
                    "hardcover_finished_at",
                    "hardcover_percent",
                    "hardcover_current_page",
                    "hardcover_current_position",
                    "hardcover_reading_format",
                    "hardcover_edition_id",
                ),
                "classes": ("collapse",),
            },
        ),
    )


class UserBookProgressAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "book",
        "edition",
        "progress_type",
        "progress_value",
        "normalized_progress",
        "last_updated",
    ]
    list_filter = ["progress_type", "user", "book"]
    search_fields = ["user__username", "book__title"]
    raw_id_fields = ["user", "book", "edition"]

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "user",
                    "book",
                    "edition",
                    "progress_type",
                    "progress_value",
                    "normalized_progress",
                    "last_updated",
                )
            },
        ),
        (
            "Rating",
            {
                "fields": ("local_rating", "hardcover_rating", "effective_rating"),
                "classes": ("collapse",),
            },
        ),
        (
            "Hardcover Data",
            {
                "fields": (
                    "hardcover_started_at",
                    "hardcover_finished_at",
                    "hardcover_percent",
                    "hardcover_current_page",
                    "hardcover_current_position",
                    "hardcover_reading_format",
                    "hardcover_edition_id",
                    "hardcover_read_id",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    readonly_fields = ["last_updated", "normalized_progress", "effective_rating"]


class MemberStartingPointAdmin(admin.ModelAdmin):
    list_display = ["member", "group", "starting_book", "set_by", "created_at"]
    list_filter = ["group"]
    search_fields = ["member__username", "group__name", "starting_book__title"]
    raw_id_fields = ["member", "group", "starting_book", "set_by"]


class DollarBetAdmin(admin.ModelAdmin):
    list_display = [
        "description",
        "book",
        "proposer",
        "accepter",
        "status",
        "amount",
        "created_at",
    ]
    list_filter = ["status", "book", "spoiler_level"]
    search_fields = [
        "description",
        "proposer__username",
        "accepter__username",
        "book__title",
    ]
    raw_id_fields = ["book", "group", "proposer", "accepter", "winner", "resolved_by"]


class CommentReactionAdmin(admin.ModelAdmin):
    list_display = ["comment", "user", "reaction", "created_at"]
    list_filter = ["reaction"]
    search_fields = ["comment__text", "user__username"]
    raw_id_fields = ["comment", "user"]


# Register models with try/except pattern to handle already registered models
try:
    admin.site.unregister(UserProfile)
except admin.sites.NotRegistered:
    pass
admin.site.register(UserProfile, UserProfileAdmin)

try:
    admin.site.unregister(BookGroup)
except admin.sites.NotRegistered:
    pass
admin.site.register(BookGroup, BookGroupAdmin)

try:
    admin.site.unregister(GroupInvitation)
except admin.sites.NotRegistered:
    pass
admin.site.register(GroupInvitation, GroupInvitationAdmin)

try:
    admin.site.unregister(Book)
except admin.sites.NotRegistered:
    pass
admin.site.register(Book, BookAdmin)

try:
    admin.site.unregister(BookEdition)
except admin.sites.NotRegistered:
    pass
admin.site.register(BookEdition, BookEditionAdmin)

try:
    admin.site.unregister(Comment)
except admin.sites.NotRegistered:
    pass
admin.site.register(Comment, CommentAdmin)

try:
    admin.site.unregister(CommentReaction)
except admin.sites.NotRegistered:
    pass
admin.site.register(CommentReaction, CommentReactionAdmin)

try:
    admin.site.unregister(UserBookProgress)
except admin.sites.NotRegistered:
    pass
admin.site.register(UserBookProgress, UserBookProgressAdmin)

try:
    admin.site.unregister(MemberStartingPoint)
except admin.sites.NotRegistered:
    pass
admin.site.register(MemberStartingPoint, MemberStartingPointAdmin)

try:
    admin.site.unregister(DollarBet)
except admin.sites.NotRegistered:
    pass
admin.site.register(DollarBet, DollarBetAdmin)
