class MediaLibraryPermissionError(Exception):
    def __init__(self, message, code, status_code):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def require_asset_owner(user, asset):
    if user.is_superuser or asset.owner_id == user.id:
        return
    raise MediaLibraryPermissionError(
        'Media ownership is required.',
        'MEDIA_OWNERSHIP_REQUIRED',
        403,
    )
