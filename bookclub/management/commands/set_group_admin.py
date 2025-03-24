from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from bookclub.models import UserProfile


class Command(BaseCommand):
    help = "Grant or revoke group creation permission for users"

    def add_arguments(self, parser):
        parser.add_argument("username", type=str, help="Username of the user")
        parser.add_argument(
            "--revoke",
            action="store_true",
            help="Revoke group creation permission instead of granting it",
        )

    def handle(self, *args, **options):
        username = options["username"]
        revoke = options["revoke"]

        try:
            user = User.objects.get(username=username)

            # Get or create user profile
            profile, created = UserProfile.objects.get_or_create(user=user)

            if revoke:
                profile.can_create_groups = False
                profile.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Successfully revoked group creation permission for {username}"
                    )
                )
            else:
                profile.can_create_groups = True
                profile.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Successfully granted group creation permission to {username}"
                    )
                )

        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User {username} does not exist"))
