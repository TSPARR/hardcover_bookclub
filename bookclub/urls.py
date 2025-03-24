from django.urls import path

from bookclub.views.auth_views import landing_page, register
from bookclub.views.book_views import (
    add_book_to_group,
    book_detail,
    get_book_editions,
    remove_book,
    search_books,
    select_edition,
    set_manual_progress,
    toggle_book_active,
    update_book_progress,
)
from bookclub.views.group_views import (
    add_group_member,
    create_group,
    group_detail,
    home,
    manage_group_members,
)
from bookclub.views.api_views import get_hardcover_progress
from bookclub.views.profile_views import profile_settings

urlpatterns = [
    path("", landing_page, name="landing_page"),
    path("home/", home, name="home"),
    path("register/", register, name="register"),
    path("profile/settings/", profile_settings, name="profile_settings"),
    # Group related URLs
    path("groups/create/", create_group, name="create_group"),
    path("groups/<int:group_id>/", group_detail, name="group_detail"),
    path(
        "groups/<int:group_id>/members/",
        manage_group_members,
        name="manage_group_members",
    ),
    path(
        "groups/<int:group_id>/members/add/", add_group_member, name="add_group_member"
    ),
    # Book related URLs
    path("books/<int:book_id>/", book_detail, name="book_detail"),
    path("groups/<int:group_id>/search/", search_books, name="search_books"),
    path(
        "groups/<int:group_id>/add-book/<str:hardcover_id>/",
        add_book_to_group,
        name="add_book_to_group",
    ),
    path(
        "books/<int:book_id>/update-progress/",
        update_book_progress,
        name="update_book_progress",
    ),
    path(
        "groups/<int:group_id>/books/<int:book_id>/remove/",
        remove_book,
        name="remove_book",
    ),
    path(
        "books/editions/<str:hardcover_id>/",
        get_book_editions,
        name="get_book_editions",
    ),
    path("books/<int:book_id>/select-edition/", select_edition, name="select_edition"),
    path(
        "books/<int:book_id>/set-progress/",
        set_manual_progress,
        name="set_manual_progress",
    ),
    path(
        "groups/<int:group_id>/books/<int:book_id>/toggle-active/",
        toggle_book_active,
        name="toggle_book_active",
    ),
    # API endpoints
    path(
        "api/hardcover-progress/<str:hardcover_id>/",
        get_hardcover_progress,
        name="get_hardcover_progress",
    ),
]
