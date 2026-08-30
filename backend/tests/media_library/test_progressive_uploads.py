import hashlib
from unittest.mock import patch

from django.core.exceptions import PermissionDenied, ValidationError
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from media_library.models import MediaAsset, MediaUploadSession, ProgressiveMediaChunk, ProgressiveMediaUpload
from media_library.progressive import classify_mp4_prefix
from media_library.services import ProgressiveUploadError, ProgressiveUploadService
from media_library.services.progressive_ingest import ProgressiveIngestError, ProgressiveIngestService


def box(kind: bytes, body: bytes = b'') -> bytes:
    return (8 + len(body)).to_bytes(4, 'big') + kind + body


class FakeProgressiveStorage:
    def __init__(self):
        self.objects = {}
        self.composed = []
        self.deleted = []

    def sign_put_object(self, *, object_key):
        return f'https://storage.test/{object_key}'

    def head(self, *, object_key):
        payload = self.objects[object_key]
        return {'size_bytes': len(payload), 'etag': hashlib.md5(payload).hexdigest()}  # nosec B324

    def stream_sha256(self, *, object_key):
        return hashlib.sha256(self.objects[object_key]).hexdigest()

    def read_prefix(self, *, object_key, max_bytes):
        return self.objects[object_key][:max_bytes]

    def compose_objects(self, *, source_keys, target_key, content_type):
        del content_type
        self.objects[target_key] = b''.join(self.objects[key] for key in source_keys)
        self.composed.append((source_keys, target_key))
        return len(self.objects[target_key])

    def delete(self, *, object_key):
        self.deleted.append(object_key)


@override_settings(
    MEDIA_PROGRESSIVE_UPLOAD_ENABLED=True,
    MEDIA_PROGRESSIVE_CHUNK_SIZE_BYTES=16,
    MEDIA_PROGRESSIVE_PREFIX_PROBE_BYTES=16,
    MEDIA_UPLOAD_MAX_SIZE_BYTES=1000,
    MEDIA_UPLOAD_SESSION_TTL_SECONDS=3600,
    MEDIA_UPLOAD_URL_TTL_SECONDS=900,
)
class ProgressiveUploadTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='progressive-owner')
        self.other = User.objects.create_user(username='progressive-other')
        self.asset = MediaAsset.objects.create(
            owner=self.owner,
            uploader=self.owner,
            title='Film',
            original_filename='film.mp4',
        )
        self.storage = FakeProgressiveStorage()

    def initiate(self, size=24):
        return ProgressiveUploadService.initiate(
            asset=self.asset, actor=self.owner, size_bytes=size, content_type='video/mp4',
        )

    def put_and_commit(self, upload, sequence, payload):
        chunk, _ = ProgressiveUploadService.sign_chunk(
            upload=upload, actor=self.owner, sequence=sequence, storage=self.storage,
        )
        self.storage.objects[chunk.object_key] = payload
        with patch('media_library.tasks.verify_progressive_media_chunk_task.delay'):
            with self.captureOnCommitCallbacks(execute=True):
                ProgressiveUploadService.commit_chunk(
                    upload=upload,
                    actor=self.owner,
                    sequence=sequence,
                    etag=hashlib.md5(payload).hexdigest(),  # nosec B324
                    checksum_sha256=hashlib.sha256(payload).hexdigest(),
                    storage=self.storage,
                )
        return chunk

    def test_detector_accepts_faststart_and_fragmented_but_rejects_moov_after_mdat(self):
        ftyp = box(b'ftyp', b'isom')
        self.assertEqual(classify_mp4_prefix(ftyp + box(b'moov')).code, 'FASTSTART_MP4')
        self.assertEqual(classify_mp4_prefix(ftyp + box(b'moov', box(b'mvex'))).code, 'FRAGMENTED_MP4')
        self.assertEqual(classify_mp4_prefix(ftyp + box(b'moof')).code, 'FRAGMENTED_MP4')
        rejected = classify_mp4_prefix(ftyp + box(b'mdat'))
        self.assertFalse(rejected.eligible)
        self.assertEqual(rejected.code, 'MP4_MOOV_AFTER_MDAT')
        large_mdat_header = (10_000_000).to_bytes(4, 'big') + b'mdat'
        self.assertEqual(
            classify_mp4_prefix(ftyp + large_mdat_header).code,
            'MP4_MOOV_AFTER_MDAT',
        )

    def test_owner_type_and_feature_flag_fail_closed(self):
        with self.assertRaises(PermissionDenied):
            ProgressiveUploadService.initiate(
                asset=self.asset, actor=self.other, size_bytes=24, content_type='video/mp4',
            )
        with self.assertRaises(ValidationError):
            ProgressiveUploadService.initiate(
                asset=self.asset, actor=self.owner, size_bytes=24, content_type='text/html',
            )
        with override_settings(MEDIA_PROGRESSIVE_UPLOAD_ENABLED=False):
            with self.assertRaises(ProgressiveUploadError) as raised:
                self.initiate()
        self.assertEqual(raised.exception.code, 'PROGRESSIVE_UPLOAD_DISABLED')

    def test_chunk_bounds_storage_metadata_checksum_and_contiguous_frontier(self):
        upload = self.initiate()
        with self.assertRaises(ValidationError):
            ProgressiveUploadService.sign_chunk(
                upload=upload, actor=self.owner, sequence=3, storage=self.storage,
            )
        chunk2 = self.put_and_commit(upload, 2, b'b' * 8)
        ProgressiveUploadService.verify_chunk(chunk_id=chunk2.pk, storage=self.storage)
        upload.refresh_from_db()
        self.assertEqual(upload.uploaded_bytes, 8)
        self.assertEqual(upload.contiguous_verified_bytes, 0)

        first_payload = box(b'ftyp') + box(b'moov')
        chunk1 = self.put_and_commit(upload, 1, first_payload)
        ProgressiveUploadService.verify_chunk(chunk_id=chunk1.pk, storage=self.storage)
        upload.refresh_from_db()
        self.assertEqual(upload.contiguous_verified_bytes, 24)
        self.assertEqual(upload.compatibility, ProgressiveMediaUpload.Compatibility.ELIGIBLE)

    def test_checksum_mismatch_fails_closed(self):
        upload = self.initiate(size=16)
        chunk, _ = ProgressiveUploadService.sign_chunk(
            upload=upload, actor=self.owner, sequence=1, storage=self.storage,
        )
        self.storage.objects[chunk.object_key] = b'x' * 16
        with patch('media_library.tasks.verify_progressive_media_chunk_task.delay'):
            ProgressiveUploadService.commit_chunk(
                upload=upload, actor=self.owner, sequence=1,
                etag=hashlib.md5(b'x' * 16).hexdigest(),  # nosec B324
                checksum_sha256='0' * 64, storage=self.storage,
            )
        with self.assertRaises(ProgressiveUploadError):
            ProgressiveUploadService.verify_chunk(chunk_id=chunk.pk, storage=self.storage)
        upload.refresh_from_db()
        self.assertEqual(upload.status, ProgressiveMediaUpload.Status.FAILED)

    def test_finalize_composes_verified_chunks_and_reuses_inspection_pipeline(self):
        upload = self.initiate()
        first = self.put_and_commit(upload, 1, box(b'ftyp') + box(b'moov'))
        second = self.put_and_commit(upload, 2, b'b' * 8)
        ProgressiveUploadService.verify_chunk(chunk_id=first.pk, storage=self.storage)
        ProgressiveUploadService.verify_chunk(chunk_id=second.pk, storage=self.storage)
        with patch('media_library.tasks.inspect_media_asset_task.delay') as delay:
            with self.captureOnCommitCallbacks(execute=True):
                completed = ProgressiveUploadService.finalize(
                    upload=upload, actor=self.owner, storage=self.storage,
                )
        self.asset.refresh_from_db()
        self.assertEqual(completed.status, ProgressiveMediaUpload.Status.COMPLETED)
        self.assertEqual(self.asset.status, MediaAsset.Status.INSPECTING)
        self.assertTrue(MediaUploadSession.objects.filter(
            asset=self.asset, status=MediaUploadSession.Status.COMPLETED,
        ).exists())
        delay.assert_called_once_with(self.asset.pk)

    @override_settings(MEDIA_PROGRESSIVE_INGEST_ENABLED=True)
    def test_first_eligible_chunk_queues_dedicated_live_ingest(self):
        upload = self.initiate(size=16)
        first = self.put_and_commit(upload, 1, box(b'ftyp') + box(b'moov'))
        with patch('media_library.tasks.ingest_progressive_media_upload_task.delay') as delay:
            with self.captureOnCommitCallbacks(execute=True):
                ProgressiveUploadService.verify_chunk(chunk_id=first.pk, storage=self.storage)
        delay.assert_called_once_with(upload.pk)

    @override_settings(MEDIA_PROGRESSIVE_INGEST_ENABLED=True)
    def test_fresh_ingest_lease_rejects_duplicate_worker(self):
        upload = self.initiate(size=16)
        upload.status = ProgressiveMediaUpload.Status.INGESTING
        upload.compatibility = ProgressiveMediaUpload.Compatibility.ELIGIBLE
        upload.ingest_heartbeat_at = timezone.now()
        upload.save(update_fields=['status', 'compatibility', 'ingest_heartbeat_at', 'updated_at'])
        with self.assertRaises(ProgressiveIngestError) as raised:
            ProgressiveIngestService._claim(upload.pk)
        self.assertEqual(raised.exception.code, 'PROGRESSIVE_INGEST_ALREADY_ACTIVE')

        upload.ingest_finished_at = timezone.now()
        upload.status = ProgressiveMediaUpload.Status.VERIFYING
        upload.save(update_fields=['ingest_finished_at', 'status', 'updated_at'])
        with self.assertRaises(ProgressiveIngestError) as finished:
            ProgressiveIngestService._claim(upload.pk)
        self.assertEqual(finished.exception.code, 'PROGRESSIVE_INGEST_ALREADY_FINISHED')


class ProgressiveUploadApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='progressive-api-owner')
        self.asset = MediaAsset.objects.create(
            owner=self.owner, uploader=self.owner, title='Film', original_filename='film.mp4',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    @override_settings(MEDIA_PROGRESSIVE_UPLOAD_ENABLED=False)
    def test_capability_does_not_claim_play_while_uploading_and_mutation_is_disabled(self):
        response = self.client.get(reverse('progressive_upload_capability'))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['data']['enabled'])
        self.assertFalse(response.data['data']['play_while_uploading'])
        response = self.client.post(
            reverse('progressive_upload_initiate', kwargs={'public_token': self.asset.public_token}),
            {'size_bytes': 24, 'content_type': 'video/mp4'}, format='json',
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'PROGRESSIVE_UPLOAD_DISABLED')

    @override_settings(
        MEDIA_PROGRESSIVE_UPLOAD_ENABLED=True,
        MEDIA_PROGRESSIVE_INGEST_ENABLED=True,
    )
    def test_capability_advertises_live_ingest_only_when_both_flags_are_enabled(self):
        response = self.client.get(reverse('progressive_upload_capability'))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['data']['play_while_uploading'])
        self.assertEqual(response.data['data']['implementation_stage'], 'live_ingest_pilot')
