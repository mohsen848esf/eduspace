from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivatePresentationStorage(FileSystemStorage):
    """Filesystem storage without a public URL for untrusted source documents."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault('location', settings.PRESENTATION_SOURCE_ROOT)
        kwargs.setdefault('base_url', None)
        super().__init__(*args, **kwargs)
