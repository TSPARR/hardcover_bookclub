from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bookclub", "0037_proposalvote"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="display_name",
            field=models.CharField(
                blank=True,
                help_text=(
                    "Name shown to other members. Falls back to the username when blank."
                ),
                max_length=80,
            ),
        ),
    ]
