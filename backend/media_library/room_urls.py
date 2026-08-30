from django.urls import path

from media_library import views


urlpatterns = [
    path('<str:room_code>/shared-playback/open/', views.open_shared_playback, name='shared_playback_open'),
    path('<str:room_code>/shared-playback/command/', views.command_shared_playback, name='shared_playback_command'),
    path('<str:room_code>/shared-playback/snapshot/', views.shared_playback_snapshot, name='shared_playback_snapshot'),
    path('<str:room_code>/shared-playback/delivery/', views.issue_shared_playback_delivery, name='shared_playback_delivery'),
]
