import os
import boto3
import logging
from django.conf import settings
from pathlib import Path

logger = logging.getLogger(__name__)

def upload_recording_to_s3(local_path: Path, s3_key: str) -> str | None:
    """
    Upload a local recording file to S3/MinIO and return the CDN URL if configured.
    """
    if not getattr(settings, 'S3_ENABLED', False):
        logger.info("S3 upload is disabled. Keeping file locally.")
        return None

    bucket = settings.AWS_STORAGE_BUCKET_NAME
    if not bucket:
        logger.error("S3_ENABLED is True but AWS_STORAGE_BUCKET_NAME is not set.")
        return None

    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        )
        
        logger.info("Uploading %s to S3 bucket %s with key %s", local_path, bucket, s3_key)
        s3_client.upload_file(str(local_path), bucket, s3_key)
        
        cdn_url = getattr(settings, 'CDN_URL', '')
        if cdn_url:
            return f"{cdn_url.rstrip('/')}/{s3_key}"
        return f"s3://{bucket}/{s3_key}"
    except Exception as e:
        logger.error("Failed to upload %s to S3: %s", local_path, e, exc_info=True)
        raise e
