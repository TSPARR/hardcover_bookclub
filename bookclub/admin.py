from django.contrib import admin

from .models import (
    Book,
    BookGroup,
    Comment,
    GroupInvitation,
    UserBookProgress,
    UserProfile,
)


class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "can_create_groups")
    list_filter = ("can_create_groups",)
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
    list_display = ("name", "created_at", "is_public", "member_count", "book_count")
    list_filter = ("is_public", "created_at")
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
    list_display = ["title", "author", "group", "is_active"]
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
                "fields": ("hardcover_id", "cover_image_url", "url", "kavita_url"),
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


admin.site.register(UserProfile, UserProfileAdmin)
admin.site.register(BookGroup, BookGroupAdmin)
admin.site.register(Book)
admin.site.register(Comment)
admin.site.register(UserBookProgress)
admin.site.register(GroupInvitation, GroupInvitationAdmin)
