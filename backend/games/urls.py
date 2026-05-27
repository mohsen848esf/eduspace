from django.urls import path
from . import views

urlpatterns = [
    path('', views.game_list, name='game_list'),
    path('<int:game_id>/session/create/', views.create_session, name='create_session'),
    path('session/<str:room_code>/', views.get_session, name='get_session'),
    path('session/<str:room_code>/join/', views.join_session, name='join_session'),
]