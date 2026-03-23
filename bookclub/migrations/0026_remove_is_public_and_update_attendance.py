# Generated manually - remove is_public and update attendance choices
from django.db import migrations, models


def migrate_maybe_to_no(apps, schema_editor):
    MeetingAttendance = apps.get_model('bookclub', 'MeetingAttendance')
    MeetingAttendance.objects.filter(rsvp_status='maybe').update(rsvp_status='no')


class Migration(migrations.Migration):
    dependencies = [
        ('bookclub', '0025_alter_meeting_options_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='meeting',
            name='is_public',
        ),
        migrations.AlterField(
            model_name='meetingattendance',
            name='rsvp_status',
            field=models.CharField(max_length=10, choices=[('yes', 'Attending'), ('no', 'Not Attending')], default='no'),
        ),
        migrations.RunPython(migrate_maybe_to_no, reverse_code=migrations.RunPython.noop),
    ]
