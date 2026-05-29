from django.urls import path

from . import views
from .recording import views as recording_views

urlpatterns = [
    path('create/', views.create_room, name='create_room'),
    path('<str:room_code>/', views.get_room, name='get_room'),
    path('<str:room_code>/join/', views.join_room, name='join_room'),
    path('<str:room_code>/leave/', views.leave_room, name='leave_room'),
    path('<str:room_code>/invite/', views.invite_to_room, name='invite_to_room'),
    path('<str:room_code>/kick/', views.kick_participant, name='kick_participant'),
    path('<str:room_code>/grant-screen-share/', views.grant_screen_share, name='grant_screen_share'),

    # --- Recording control (host only, except status which is participant-level) ---
    path('<str:room_code>/recording/start/', recording_views.start_recording, name='recording_start'),
    path('<str:room_code>/recording/stop/', recording_views.stop_recording, name='recording_stop'),
    path('<str:room_code>/recording/pause/', recording_views.pause_recording, name='recording_pause'),
    path('<str:room_code>/recording/resume/', recording_views.resume_recording, name='recording_resume'),
    path('<str:room_code>/recording/status/', recording_views.recording_status, name='recording_status'),
]
