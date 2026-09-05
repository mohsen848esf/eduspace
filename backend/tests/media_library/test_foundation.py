from datetime import timedelta
from unittest.mock import patch

from django.core.exceptions import PermissionDenied, ValidationError
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import Organization, User
from media_library.models import (
    MediaAsset, MediaRendition, ProgressiveMediaUpload, SharedPlaybackSession,
)
from media_library.services import MediaAssetService, SharedPlaybackService
from rooms.models import Room


class SharedMediaFoundationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner')
        self.cohost = User.objects.create_user(username='cohost')
        self.viewer = User.objects.create_user(username='viewer')
        self.org = Organization.objects.create(name='Cinema Org', slug='cinema-org', owner=self.owner)
        self.room_one = Room.objects.create(
            room_code='CINE01', name='Cinema 1', host=self.owner,
            organization=self.org, status=Room.Status.ACTIVE,
        )
        self.room_two = Room.objects.create(
            room_code='CINE02', name='Cinema 2', host=self.owner,
            organization=self.org, status=Room.Status.ACTIVE,
        )
        self.room_one.co_hosts.add(self.cohost)
        self.asset = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Long lesson movie',
            status=MediaAsset.Status.READY,
            duration_ms=7_200_000,
        )

    def test_asset_is_persistent_by_default(self):
        self.assertEqual(self.asset.retention_policy, MediaAsset.RetentionPolicy.MANUAL)
        self.assertIsNone(self.asset.expires_at)
        self.assertFalse(self.asset.is_deleted)

    def test_same_asset_can_continue_in_another_room(self):
        first = SharedPlaybackService.open_session(
            room=self.room_one, asset=self.asset, actor=self.owner,
        )
        first = SharedPlaybackService.apply_command(
            playback=first, actor=self.owner, command='STOP',
            expected_version=1, position_ms=2_700_000,
        )
        second = SharedPlaybackService.open_session(
            room=self.room_two, asset=self.asset, actor=self.owner,
            resumed_from=first,
        )
        self.assertEqual(second.anchor_position_ms, 2_700_000)
        self.assertEqual(second.resumed_from_id, first.id)
        self.assertEqual(self.asset.playback_sessions.count(), 2)

    def test_opening_the_active_asset_again_is_idempotent(self):
        first = SharedPlaybackService.open_session(
            room=self.room_one, asset=self.asset, actor=self.owner,
        )
        retry = SharedPlaybackService.open_session(
            room=self.room_one, asset=self.asset, actor=self.owner,
        )
        self.assertEqual(retry.pk, first.pk)
        self.assertEqual(self.asset.playback_sessions.count(), 1)

    def test_media_owned_by_unrelated_account_cannot_be_played(self):
        other_owner = User.objects.create_user(username='other-owner')
        other_asset = MediaAsset.objects.create(
            owner=other_owner,
            uploader=other_owner,
            title='Other asset',
            status=MediaAsset.Status.READY,
        )
        with self.assertRaises(PermissionDenied):
            SharedPlaybackService.open_session(
                room=self.room_one, asset=other_asset, actor=self.owner,
            )

    def test_ended_room_cannot_start_playback(self):
        self.room_one.status = Room.Status.ENDED
        self.room_one.save(update_fields=['status'])
        with self.assertRaises(ValidationError):
            SharedPlaybackService.open_session(
                room=self.room_one, asset=self.asset, actor=self.owner,
            )

    def test_only_moderators_can_control_playback(self):
        with self.assertRaises(PermissionDenied):
            SharedPlaybackService.open_session(
                room=self.room_one, asset=self.asset, actor=self.viewer,
            )
        playback = SharedPlaybackService.open_session(
            room=self.room_one, asset=self.asset, actor=self.cohost,
        )
        self.assertEqual(playback.controller, self.cohost)

    def test_stale_command_cannot_overwrite_newer_state(self):
        playback = SharedPlaybackService.open_session(
            room=self.room_one, asset=self.asset, actor=self.owner,
        )
        updated = SharedPlaybackService.apply_command(
            playback=playback, actor=self.owner, command='PLAY',
            expected_version=1, position_ms=10_000,
            effective_at=timezone.now() + timedelta(seconds=2),
        )
        self.assertEqual(updated.version, 2)
        with self.assertRaises(ValidationError):
            SharedPlaybackService.apply_command(
                playback=updated, actor=self.owner, command='PAUSE',
                expected_version=1, position_ms=12_000,
            )

    def test_sync_policy_and_buffer_reason_are_authoritative_session_state(self):
        playback = SharedPlaybackService.open_session(
            room=self.room_one, asset=self.asset, actor=self.owner,
        )
        self.assertEqual(playback.sync_policy, SharedPlaybackSession.SyncPolicy.CONTINUOUS)
        buffering = SharedPlaybackService.apply_command(
            playback=playback,
            actor=self.owner,
            command='BUFFERING',
            expected_version=1,
            position_ms=10_000,
            buffer_reason=SharedPlaybackSession.BufferReason.FRONTIER,
        )
        self.assertEqual(buffering.state, SharedPlaybackSession.State.BUFFERING)
        self.assertEqual(buffering.buffer_reason, SharedPlaybackSession.BufferReason.FRONTIER)
        strict = SharedPlaybackService.apply_command(
            playback=buffering,
            actor=self.owner,
            command='SET_SYNC_POLICY',
            expected_version=2,
            sync_policy=SharedPlaybackSession.SyncPolicy.STRICT,
        )
        self.assertEqual(strict.sync_policy, SharedPlaybackSession.SyncPolicy.STRICT)
        resumed = SharedPlaybackService.apply_command(
            playback=strict,
            actor=self.owner,
            command='PLAY',
            expected_version=3,
        )
        self.assertEqual(resumed.buffer_reason, SharedPlaybackSession.BufferReason.NONE)

    def test_seek_preserves_playing_state(self):
        playback = SharedPlaybackService.open_session(
            room=self.room_one, asset=self.asset, actor=self.owner,
        )
        playing = SharedPlaybackService.apply_command(
            playback=playback, actor=self.owner, command='PLAY',
            expected_version=1, position_ms=10_000,
        )
        sought = SharedPlaybackService.apply_command(
            playback=playing, actor=self.owner, command='SEEK',
            expected_version=2, position_ms=40_000,
        )
        self.assertEqual(sought.state, SharedPlaybackSession.State.PLAYING)
        self.assertEqual(sought.anchor_position_ms, 40_000)

    def test_expected_position_projects_from_server_anchor(self):
        effective_at = timezone.now() - timedelta(seconds=3)
        playback = SharedPlaybackSession.objects.create(
            room=self.room_one,
            asset=self.asset,
            controller=self.owner,
            state=SharedPlaybackSession.State.PLAYING,
            anchor_position_ms=20_000,
            effective_at=effective_at,
        )
        projected = playback.expected_position_ms(effective_at + timedelta(seconds=2))
        self.assertEqual(projected, 22_000)

    def test_partially_uploaded_asset_cannot_seek_past_published_frontier(self):
        partial = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Still uploading',
            status=MediaAsset.Status.PARTIALLY_PLAYABLE,
            duration_ms=7_200_000,
        )
        MediaRendition.objects.create(
            asset=partial,
            label='720p',
            status=MediaRendition.Status.PLAYABLE,
            published_duration_ms=300_000,
        )
        playback = SharedPlaybackService.open_session(
            room=self.room_one,
            asset=partial,
            actor=self.owner,
            start_position_ms=290_000,
        )
        with self.assertRaises(ValidationError):
            SharedPlaybackService.apply_command(
                playback=playback,
                actor=self.owner,
                command='SEEK',
                expected_version=1,
                position_ms=301_000,
            )

    @override_settings(
        MEDIA_PROGRESSIVE_UPLOAD_ENABLED=True,
        MEDIA_PROGRESSIVE_INGEST_ENABLED=True,
        MEDIA_PROGRESSIVE_SEEK_GUARD_MS=8_000,
    )
    def test_growing_asset_reserves_safety_guard_from_published_frontier(self):
        partial = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Growing upload',
            status=MediaAsset.Status.PARTIALLY_PLAYABLE,
        )
        MediaRendition.objects.create(
            asset=partial,
            label='progressive',
            status=MediaRendition.Status.PLAYABLE,
            published_duration_ms=30_000,
        )
        ProgressiveMediaUpload.objects.create(
            asset=partial,
            status=ProgressiveMediaUpload.Status.INGESTING,
            compatibility=ProgressiveMediaUpload.Compatibility.ELIGIBLE,
            expected_size_bytes=100,
            chunk_size_bytes=100,
            content_type='video/mp4',
            object_prefix='guard-test',
            expires_at=timezone.now() + timedelta(hours=1),
        )
        self.assertEqual(partial.seekable_until_ms, 22_000)
        with self.assertRaises(ValidationError):
            SharedPlaybackService.open_session(
                room=self.room_one,
                asset=partial,
                actor=self.owner,
                start_position_ms=22_001,
            )
        playback = SharedPlaybackService.open_session(
            room=self.room_one,
            asset=partial,
            actor=self.owner,
        )
        paused = SharedPlaybackService.apply_command(
            playback=playback,
            actor=self.owner,
            command='PAUSE',
            expected_version=1,
            position_ms=29_000,
        )
        self.assertEqual(paused.anchor_position_ms, 29_000)

    def test_manual_delete_is_blocked_while_playing_and_allowed_after_stop(self):
        playback = SharedPlaybackService.open_session(
            room=self.room_one, asset=self.asset, actor=self.owner,
        )
        with self.assertRaises(ValidationError):
            MediaAssetService.mark_deleted(asset=self.asset, actor=self.owner)
        SharedPlaybackService.apply_command(
            playback=playback, actor=self.owner, command='STOP', expected_version=1,
        )
        deleted = MediaAssetService.mark_deleted(asset=self.asset, actor=self.owner)
        self.assertTrue(deleted.is_deleted)
        self.assertIsNotNone(deleted.deleted_at)

    def test_non_owner_non_uploader_cannot_delete_asset(self):
        with self.assertRaises(PermissionDenied):
            MediaAssetService.mark_deleted(asset=self.asset, actor=self.viewer)

    @patch('media_library.tasks.purge_deleted_media_asset_task.delay')
    @patch('config.celery.app.control.revoke')
    def test_delete_revokes_active_task_and_enqueues_storage_purge(self, revoke, purge_delay):
        self.asset.active_task_id = 'celery-task-123'
        self.asset.save(update_fields=['active_task_id'])

        with self.captureOnCommitCallbacks(execute=True):
            MediaAssetService.mark_deleted(asset=self.asset, actor=self.owner)

        revoke.assert_called_once_with('celery-task-123')
        purge_delay.assert_called_once_with(self.asset.pk)

    @patch('media_library.tasks.purge_deleted_media_asset_task.delay')
    @patch('config.celery.app.control.revoke')
    def test_delete_without_an_active_task_still_enqueues_purge(self, revoke, purge_delay):
        with self.captureOnCommitCallbacks(execute=True):
            MediaAssetService.mark_deleted(asset=self.asset, actor=self.owner)

        revoke.assert_not_called()
        purge_delay.assert_called_once_with(self.asset.pk)
