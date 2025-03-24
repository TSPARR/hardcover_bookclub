from django.urls import path

from . import views

urlpatterns = [
    path("", views.landing_page, name="landing_page"),
    path("home/", views.home, name="home"),
    path("books/<int:book_id>/", views.book_detail, name="book_detail"),
    path(
        "books/<int:book_id>/update-progress/",
        views.update_book_progress,
        name="update_book_progress",
    ),
    path(
        "get-hardcover-progress/<str:hardcover_id>/",
        views.get_hardcover_progress,
        name="get_hardcover_progress",
    ),
    path("groups/<int:group_id>/search/", views.search_books, name="search_books"),
    path(
        "groups/<int:group_id>/add_book/<str:hardcover_id>/",
        views.add_book_to_group,
        name="add_book_to_group",
    ),
    path("register/", views.register, name="register"),
    path("profile/settings/", views.profile_settings, name="profile_settings"),
    path(
        "api/books/<str:hardcover_id>/progress/",
        views.get_hardcover_progress,
        name="get_hardcover_progress",
    ),
    path("groups/create/", views.create_group, name="create_group"),
    path("groups/<int:group_id>/", views.group_detail, name="group_detail"),
    path(
        "groups/<int:group_id>/members/",
        views.manage_group_members,
        name="manage_group_members",
    ),
    path(
        "groups/<int:group_id>/members/add/",
        views.add_group_member,
        name="add_group_member",
    ),
    path(
        "groups/<int:group_id>/books/<int:book_id>/remove/",
        views.remove_book,
        name="remove_book",
    ),
]
