from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('media_library', '0007_progressive_ingest_state'),
    ]

    operations = [
        migrations.AddField(
            model_name='sharedplaybacksession',
            name='buffer_reason',
            field=models.CharField(
                blank=True,
                choices=[('', 'None'), ('frontier', 'Upload frontier'), ('readiness', 'Participant readiness')],
                default='',
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name='sharedplaybacksession',
            name='sync_policy',
            field=models.CharField(
                choices=[('continuous', 'Continuous playback'), ('strict', 'Strict synchronization')],
                default='continuous',
                max_length=16,
            ),
        ),
    ]
