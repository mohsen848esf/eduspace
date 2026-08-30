from decimal import Decimal

import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models

import media_library.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('accounts', '0032_organization_branding'),
        ('rooms', '0014_presentation_processing_pipeline'),
    ]

    operations = [
        migrations.CreateModel(
            name='MediaAsset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_token', models.CharField(default=media_library.models._make_public_token, editable=False, max_length=32, unique=True)),
                ('title', models.CharField(max_length=255)),
                ('original_filename', models.CharField(blank=True, default='', max_length=255)),
                ('source_file', models.FileField(blank=True, null=True, upload_to=media_library.models.media_source_upload_path)),
                ('status', models.CharField(choices=[('uploading', 'Uploading'), ('uploaded', 'Uploaded'), ('inspecting', 'Inspecting'), ('processing', 'Processing'), ('partially_playable', 'Partially playable'), ('ready', 'Ready'), ('failed', 'Failed')], default='uploading', max_length=32)),
                ('content_type', models.CharField(blank=True, default='', max_length=100)),
                ('container', models.CharField(blank=True, default='', max_length=32)),
                ('video_codec', models.CharField(blank=True, default='', max_length=32)),
                ('audio_codec', models.CharField(blank=True, default='', max_length=32)),
                ('duration_ms', models.PositiveBigIntegerField(default=0)),
                ('size_bytes', models.PositiveBigIntegerField(default=0)),
                ('width', models.PositiveIntegerField(default=0)),
                ('height', models.PositiveIntegerField(default=0)),
                ('checksum_sha256', models.CharField(blank=True, default='', max_length=64)),
                ('failure_code', models.CharField(blank=True, default='', max_length=64)),
                ('retention_policy', models.CharField(choices=[('manual', 'Manual deletion only'), ('scheduled', 'Scheduled expiry')], default='manual', max_length=16)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='media_assets', to='accounts.organization')),
                ('uploader', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_media_assets', to='accounts.user')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='MediaRendition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=32)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('playable', 'Playable'), ('ready', 'Ready'), ('failed', 'Failed')], default='pending', max_length=16)),
                ('width', models.PositiveIntegerField(default=0)),
                ('height', models.PositiveIntegerField(default=0)),
                ('bitrate_bps', models.PositiveIntegerField(default=0)),
                ('manifest_path', models.CharField(blank=True, default='', max_length=500)),
                ('published_duration_ms', models.PositiveBigIntegerField(default=0)),
                ('is_default', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('asset', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='renditions', to='media_library.mediaasset')),
            ],
        ),
        migrations.CreateModel(
            name='SharedPlaybackSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('state', models.CharField(choices=[('idle', 'Idle'), ('playing', 'Playing'), ('paused', 'Paused'), ('buffering', 'Buffering'), ('ended', 'Ended')], default='idle', max_length=16)),
                ('version', models.PositiveBigIntegerField(default=1)),
                ('anchor_position_ms', models.PositiveBigIntegerField(default=0)),
                ('effective_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('playback_rate', models.DecimalField(decimal_places=2, default=Decimal('1.00'), max_digits=4, validators=[django.core.validators.MinValueValidator(Decimal('0.25'))])),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('ended_at', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('asset', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='playback_sessions', to='media_library.mediaasset')),
                ('controller', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='controlled_media_playbacks', to='accounts.user')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shared_playback_sessions', to='accounts.organization')),
                ('resumed_from', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='continuations', to='media_library.sharedplaybacksession')),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shared_playback_sessions', to='rooms.room')),
            ],
            options={'ordering': ['-started_at']},
        ),
        migrations.AddIndex(model_name='mediaasset', index=models.Index(fields=['organization', 'is_deleted', '-created_at'], name='media_libra_organiz_da85cf_idx')),
        migrations.AddIndex(model_name='mediaasset', index=models.Index(fields=['organization', 'status'], name='media_libra_organiz_76a0d9_idx')),
        migrations.AddConstraint(model_name='mediarendition', constraint=models.UniqueConstraint(fields=('asset', 'label'), name='unique_media_rendition_label_per_asset')),
        migrations.AddIndex(model_name='mediarendition', index=models.Index(fields=['asset', 'status'], name='media_libra_asset_i_505bc3_idx')),
        migrations.AddConstraint(model_name='sharedplaybacksession', constraint=models.UniqueConstraint(condition=models.Q(('ended_at__isnull', True)), fields=('room',), name='one_open_shared_playback_per_room')),
        migrations.AddIndex(model_name='sharedplaybacksession', index=models.Index(fields=['organization', 'asset', '-started_at'], name='media_libra_organiz_a06ae1_idx')),
        migrations.AddIndex(model_name='sharedplaybacksession', index=models.Index(fields=['room', 'ended_at'], name='media_libra_room_id_2def77_idx')),
    ]
