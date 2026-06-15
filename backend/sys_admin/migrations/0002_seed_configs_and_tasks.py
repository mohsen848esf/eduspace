from django.db import migrations

def seed_data(apps, schema_editor):
    SystemConfig = apps.get_model('sys_admin', 'SystemConfig')
    
    defaults = [
        ('FREE_PLAN_STUDENT_LIMIT', '100', 'Maximum students allowed for free plan'),
        ('MAX_UPLOAD_SIZE_MB', '50', 'Maximum size of file upload in MB'),
        ('DEFAULT_ROOM_DURATION', '60', 'Default room duration in minutes'),
        ('MAX_RECORDING_FILE_SIZE', '2048', 'Maximum recording file size in MB'),
    ]
    
    for key, val, desc in defaults:
        SystemConfig.objects.get_or_create(key=key, defaults={'value': val, 'description': desc})

    # Try seeding celery beat periodic task
    try:
        from django_celery_beat.models import PeriodicTask, CrontabSchedule
        schedule, _ = CrontabSchedule.objects.get_or_create(
            minute='0',
            hour='0',
            day_of_week='*',
            day_of_month='*',
            month_of_year='*',
            timezone='Asia/Tehran'
        )
        PeriodicTask.objects.get_or_create(
            name="Daily usage recalculation",
            defaults={
                'task': "sys_admin.tasks.daily_usage_recalculation",
                'crontab': schedule,
            }
        )
    except Exception:
        pass

def rollback_data(apps, schema_editor):
    SystemConfig = apps.get_model('sys_admin', 'SystemConfig')
    SystemConfig.objects.filter(key__in=[
        'FREE_PLAN_STUDENT_LIMIT',
        'MAX_UPLOAD_SIZE_MB',
        'DEFAULT_ROOM_DURATION',
        'MAX_RECORDING_FILE_SIZE'
    ]).delete()

    try:
        from django_celery_beat.models import PeriodicTask
        PeriodicTask.objects.filter(task="sys_admin.tasks.daily_usage_recalculation").delete()
    except Exception:
        pass

class Migration(migrations.Migration):

    dependencies = [
        ('sys_admin', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_data, rollback_data),
    ]
