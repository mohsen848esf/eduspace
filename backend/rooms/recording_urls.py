"""
URL patterns mounted at /api/recordings/.

Recording library + LiveKit egress webhook.
"""

from django.urls import path

from .recording import views as recording_views

urlpatterns = [
    path(
        'webhook/',
        recording_views.egress_webhook,
        name='recording_webhook',
    ),
    path(
        '',
        recording_views.list_recordings,
        name='recording_list',
    ),
    path(
        '<str:token>/',
        recording_views.recording_detail_or_delete,
        name='recording_detail',
    ),
    path(
        '<str:token>/stream/',
        recording_views.stream_recording,
        name='recording_stream',
    ),
]
