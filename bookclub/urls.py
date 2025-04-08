import os

from django.conf import settings
from django.contrib.auth import views as auth_views
from django.contrib.staticfiles.storage import staticfiles_storage
from django.http import HttpResponse
from django.urls import path
from django.views.generic import TemplateView

from bookclub.views.api_views import get_hardcover_progress
from bookclub.views.attribution_analytics import attribution_analytics
from bookclub.views.auth_views import landing_page, register_with_invite
from bookclub.views.book_views import (
    add_book_to_group,
    book_detail,
    delete_comment,
    edit_comment,
    get_book_editions,
    manage_promoted_editions,
    quick_select_edition,
    refresh_book_from_hardcover,
    remove_book,
    reply_to_comment,
    search_books,
    select_edition,
    set_manual_progress,
    toggle_book_active,
    toggle_reaction,
    update_book_progress,
    update_book_rating,
)
from bookclub.views.comment_utils import get_comment_reaction_users
from bookclub.views.dollar_bets import (
    accept_dollar_bet,
    admin_create_dollar_bet,
    create_dollar_bet,
    delete_dollar_bet,
    dollar_bets_group_list,
    dollar_bets_list,
    resolve_dollar_bet,
)
from bookclub.views.group_views import (
    add_group_member,
    create_group,
    group_detail,
    home,
    manage_group_members,
    manage_member_starting_points,
    update_group_settings,
)
from bookclub.views.invitation_views import (
    create_invitation,
    manage_invitations,
    revoke_invitation,
)
from bookclub.views.profile_views import (
    get_vapid_public_key,
    profile_settings,
    push_subscribe,
    push_unsubscribe,
    test_push_notification,
)


def serve_service_worker(request):
    # Path to the service worker file - fix the path to match your directory structure
    sw_path = os.path.join(
        settings.BASE_DIR, "bookclub", "static", "push-service-worker.js"
    )

    # Read the file content
    try:
        with open(sw_path, "r") as file:
            content = file.read()
    except FileNotFoundError:
        return HttpResponse(f"Service worker not found at {sw_path}", status=404)

    # Serve with correct content type and cache control headers
    response = HttpResponse(content, content_type="application/javascript")
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


urlpatterns = [
    path("", landing_page, name="landing_page"),
    path("home/", home, name="home"),
    path("profile/settings/", profile_settings, name="profile_settings"),
    path(
        "accounts/logout/",
        auth_views.LogoutView.as_view(next_page="landing_page"),
        name="logout",
    ),
    path(
        "register/<uuid:invite_code>/",
        register_with_invite,
        name="register_with_invite",
    ),
    path(
        "groups/<int:group_id>/invitations/",
        manage_invitations,
        name="manage_invitations",
    ),
    path(
        "groups/<int:group_id>/invitations/create/",
        create_invitation,
        name="create_invitation",
    ),
    path(
        "groups/<int:group_id>/invitations/<int:invitation_id>/revoke/",
        revoke_invitation,
        name="revoke_invitation",
    ),
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
    path(
        "group/<int:group_id>/settings/update/",
        update_group_settings,
        name="update_group_settings",
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
        "books/<int:book_id>/promoted-editions/",
        manage_promoted_editions,
        name="manage_promoted_editions",
    ),
    path(
        "books/<int:book_id>/set-progress/",
        set_manual_progress,
        name="set_manual_progress",
    ),
    path(
        "books/<int:book_id>/quick-select-edition/",
        quick_select_edition,
        name="quick_select_edition",
    ),
    path(
        "books/<int:book_id>/update-rating/",
        update_book_rating,
        name="update_book_rating",
    ),
    path(
        "book/<int:book_id>/refresh",
        refresh_book_from_hardcover,
        name="refresh_book_from_hardcover",
    ),
    path(
        "groups/<int:group_id>/books/<int:book_id>/toggle-active/",
        toggle_book_active,
        name="toggle_book_active",
    ),
    path(
        "group/<int:group_id>/attribution/",
        attribution_analytics,
        name="attribution_analytics",
    ),
    path(
        "group/<int:group_id>/starting-points/",
        manage_member_starting_points,
        name="manage_member_starting_points",
    ),
    path("comments/<int:comment_id>/edit/", edit_comment, name="edit_comment"),
    path("comments/<int:comment_id>/delete/", delete_comment, name="delete_comment"),
    path(
        "comments/<int:comment_id>/reaction/", toggle_reaction, name="toggle_reaction"
    ),
    path("comments/<int:comment_id>/reply/", reply_to_comment, name="reply_to_comment"),
    # API endpoints
    path(
        "api/hardcover-progress/<str:hardcover_id>/",
        get_hardcover_progress,
        name="get_hardcover_progress",
    ),
    path(
        "comments/<int:comment_id>/reaction-users/",
        get_comment_reaction_users,
        name="get_comment_reaction_users",
    ),
    # Dollar Bets
    path(
        "book/<int:book_id>/dollar-bets/",
        dollar_bets_list,
        name="dollar_bets_list",
    ),
    path(
        "book/<int:book_id>/dollar-bets/create/",
        create_dollar_bet,
        name="create_dollar_bet",
    ),
    path(
        "dollar-bet/<int:bet_id>/accept/",
        accept_dollar_bet,
        name="accept_dollar_bet",
    ),
    path(
        "dollar-bet/<int:bet_id>/resolve/",
        resolve_dollar_bet,
        name="resolve_dollar_bet",
    ),
    path(
        "dollar-bet/<int:bet_id>/delete/",
        delete_dollar_bet,
        name="delete_dollar_bet",
    ),
    path(
        "group/<int:group_id>/dollar-bets/",
        dollar_bets_group_list,
        name="dollar_bets_group_list",
    ),
    path(
        "book/<int:book_id>/dollar-bets/admin-create/",
        admin_create_dollar_bet,
        name="admin_create_dollar_bet",
    ),
    # Dedicated URL for service worker with minimal scope
    path(
        "push-service-worker.js",
        serve_service_worker,
        name="bookclub/push-service-worker",
    ),
    # Create a placeholder push route for the service worker scope
    path(
        "push/",
        TemplateView.as_view(template_name="push_placeholder.html"),
        name="push-placeholder",
    ),
    # API endpoints
    path(
        "api/push/vapid-public-key/",
        get_vapid_public_key,
        name="vapid-public-key",
    ),
    path("api/push/subscribe/", push_subscribe, name="push-subscribe"),
    path("api/push/unsubscribe/", push_unsubscribe, name="push-unsubscribe"),
    path(
        "api/push/test/",
        test_push_notification,
        name="test-push-notification",
    ),
]
