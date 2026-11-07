from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import BookGroup, get_user_display_name


class DisplayNameTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reader_one", password="test-password"
        )
        self.client.force_login(self.user)

    def test_display_name_falls_back_to_username(self):
        self.assertEqual(get_user_display_name(self.user), "reader_one")

    def test_display_name_can_be_saved_from_profile_settings(self):
        response = self.client.post(
            reverse("profile_settings"),
            {"display_name": "  Reader One  ", "save_display_name": ""},
            follow=True,
            secure=True,
        )

        self.user.profile.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.user.profile.display_name, "Reader One")
        self.assertContains(response, "Your display name has been updated.")

    def test_group_page_uses_display_name_for_members(self):
        other_user = User.objects.create_user(username="reader_two")
        other_user.profile.display_name = "Reader Two"
        other_user.profile.save(update_fields=["display_name"])

        group = BookGroup.objects.create(name="Test Book Club")
        group.members.add(self.user, other_user)

        response = self.client.get(
            reverse("group_detail", args=[group.id]), secure=True
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Reader Two (reader_two)")
        self.assertNotContains(response, ">reader_two<")

    def test_group_page_uses_only_username_when_display_names_are_disabled(self):
        other_user = User.objects.create_user(username="reader_two")
        other_user.profile.display_name = "Reader Two"
        other_user.profile.save(update_fields=["display_name"])

        group = BookGroup.objects.create(
            name="Username Only Club", enable_display_names=False
        )
        group.members.add(self.user, other_user)

        response = self.client.get(
            reverse("group_detail", args=[group.id]), secure=True
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response, '<span class="member-name">reader_two</span>', html=True
        )
        self.assertNotContains(response, "Reader Two (reader_two)")

    def test_group_admin_can_toggle_display_names(self):
        group = BookGroup.objects.create(name="Configurable Club")
        group.members.add(self.user)
        group.admins.add(self.user)

        self.client.post(reverse("update_group_settings", args=[group.id]), secure=True)
        group.refresh_from_db()
        self.assertFalse(group.enable_display_names)

        self.client.post(
            reverse("update_group_settings", args=[group.id]),
            {"enable_display_names": "on"},
            secure=True,
        )
        group.refresh_from_db()
        self.assertTrue(group.enable_display_names)
