"""
URL patterns mounted at /api/recordings/.

Currently only the egress webhook lives here; sub-task 2.3 will add
list/detail/stream endpoints alongside it.
"""

from django.urls import path

from .recording import views as recording_views

urlpatterns = [
    path('webhook/', recording_views.egress_webhook, name='recording_webhook'),
]
