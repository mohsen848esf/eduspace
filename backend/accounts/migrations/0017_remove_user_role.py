# Generated manually for Sprint D.4
from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_seed_session_attendance_permissions'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='role',
        ),
    ]
