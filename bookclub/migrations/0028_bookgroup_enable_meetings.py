from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookclub", "0027_meeting_description"),
    ]

    operations = [
        migrations.AddField(
            model_name="bookgroup",
            name="enable_meetings",
            field=models.BooleanField(
                default=True,
                help_text="Enable Meetings in this group",
            ),
        ),
    ]
