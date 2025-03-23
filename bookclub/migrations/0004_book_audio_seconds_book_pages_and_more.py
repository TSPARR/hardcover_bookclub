# Generated by Django 5.1.7 on 2025-03-23 23:05

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookclub", "0003_alter_userprofile_hardcover_api_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="book",
            name="audio_seconds",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="book",
            name="pages",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="comment",
            name="hardcover_current_page",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="comment",
            name="hardcover_current_position",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="comment",
            name="hardcover_edition_id",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="comment",
            name="hardcover_finished_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="comment",
            name="hardcover_percent",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="comment",
            name="hardcover_reading_format",
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name="comment",
            name="hardcover_started_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
