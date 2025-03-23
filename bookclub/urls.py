from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("groups/<int:group_id>/", views.group_detail, name="group_detail"),
    path("books/<int:book_id>/", views.book_detail, name="book_detail"),
    path("groups/<int:group_id>/search/", views.search_books, name="search_books"),
    path(
        "groups/<int:group_id>/add_book/<str:hardcover_id>/",
        views.add_book_to_group,
        name="add_book_to_group",
    ),
    path("register/", views.register, name="register"),
]
