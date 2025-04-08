# Generated by Django 5.1.8 on 2025-04-07 21:44

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookclub", "0018_alter_dollarbet_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="enable_notifications",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="push_subscription",
            field=models.TextField(blank=True, null=True),
        ),
    ]
