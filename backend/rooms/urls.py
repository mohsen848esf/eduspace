from django.urls import path

from . import views
from .recording import views as recording_views

urlpatterns = [
    path('create/', views.create_room, name='create_room'),
    path('<str:room_code>/', views.get_room, name='get_room'),
    path('<str:room_code>/join/', views.join_room, name='join_room'),
    path('<str:room_code>/guest-join/', views.guest_join_room, name='guest_join_room'),
    path('<str:room_code>/leave/', views.leave_room, name='leave_room'),
    path('<str:room_code>/invite/', views.invite_to_room, name='invite_to_room'),
    path('<str:room_code>/kick/', views.kick_participant, name='kick_participant'),
    path('<str:room_code>/grant-screen-share/', views.grant_screen_share, name='grant_screen_share'),
    path('<str:room_code>/raise-hand/', views.raise_hand, name='raise_hand'),
    path('<str:room_code>/lower-all-hands/', views.lower_all_hands, name='lower_all_hands'),
    path('<str:room_code>/participants-history/', views.room_participants_history, name='room_participants_history'),

    # --- Access Settings & Media Permissions (host & co-hosts) ---
    path('<str:room_code>/settings/', views.room_settings, name='room_settings'),
    path('<str:room_code>/grant-media-permission/', views.grant_media_permission, name='grant_media_permission'),

    # --- Co-Host Delegation ---
    path('<str:room_code>/co-hosts/', views.list_co_hosts, name='list_co_hosts'),
    path('<str:room_code>/co-hosts/grant/', views.grant_co_host, name='grant_co_host'),
    path('<str:room_code>/co-hosts/revoke/', views.revoke_co_host, name='revoke_co_host'),

    # --- Lobby / Admit System ---
    path('<str:room_code>/lobby/', views.lobby_list, name='lobby_list'),
    path('<str:room_code>/lobby/admit-all/', views.lobby_admit_all, name='lobby_admit_all'),
    path('<str:room_code>/lobby/deny-all/', views.lobby_deny_all, name='lobby_deny_all'),
    path('<str:room_code>/lobby/<int:request_id>/admit/', views.lobby_admit, name='lobby_admit'),
    path('<str:room_code>/lobby/<int:request_id>/deny/', views.lobby_deny, name='lobby_deny'),
    path('<str:room_code>/lobby/status/<int:request_id>/', views.lobby_status, name='lobby_status'),

    # --- Recording control (host only, except status which is participant-level) ---
    path('<str:room_code>/recording/start/', recording_views.start_recording, name='recording_start'),
    path('<str:room_code>/recording/start-client/', recording_views.start_client_recording, name='recording_start_client'),
    path('<str:room_code>/recording/stop/', recording_views.stop_recording, name='recording_stop'),
    path('<str:room_code>/recording/pause/', recording_views.pause_recording, name='recording_pause'),
    path('<str:room_code>/recording/resume/', recording_views.resume_recording, name='recording_resume'),
    path('<str:room_code>/recording/status/', recording_views.recording_status, name='recording_status'),
    # Host delegates recording control to a participant; participant polls
    # to learn whether they're allowed to drive the controls.
    path(
        '<str:room_code>/recording/permission/',
        recording_views.recording_permission,
        name='recording_permission',
    ),
    path(
        '<str:room_code>/recording/permission/set/',
        recording_views.set_recording_permission,
        name='recording_permission_set',
    ),
]
