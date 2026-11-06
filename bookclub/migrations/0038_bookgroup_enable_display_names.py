from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bookclub", "0037_userprofile_display_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="bookgroup",
            name="enable_display_names",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "Show member display names alongside their usernames in this group"
                ),
            ),
        ),
    ]
