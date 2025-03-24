from django.contrib import admin
from .models import BookGroup, Book, Comment, UserProfile, UserBookProgress


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


admin.site.register(UserProfile, UserProfileAdmin)
admin.site.register(BookGroup, BookGroupAdmin)
admin.site.register(Book)
admin.site.register(Comment)
admin.site.register(UserBookProgress)
