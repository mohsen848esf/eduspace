from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_room, name='create_room'),
    path('<str:room_code>/', views.get_room, name='get_room'),
    path('<str:room_code>/join/', views.join_room, name='join_room'),
    path('<str:room_code>/leave/', views.leave_room, name='leave_room'),
    path('<str:room_code>/invite/', views.invite_to_room, name='invite_to_room'),
    path('<str:room_code>/kick/', views.kick_participant, name='kick_participant'),
    path('<str:room_code>/grant-screen-share/', views.grant_screen_share, name='grant_screen_share'),
]