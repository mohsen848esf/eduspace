from django.urls import path
from . import views
from . import notifications as notifications_views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('me/', views.me, name='me'),
    path('logout/', views.logout, name='logout'),
    path('search/', views.search_users, name='search_users'),

    # Persistent notifications inbox.
    path(
        'notifications/',
        notifications_views.list_notifications,
        name='notifications_list',
    ),
    path(
        'notifications/read-all/',
        notifications_views.mark_all_notifications_read,
        name='notifications_read_all',
    ),
    path(
        'notifications/<int:pk>/read/',
        notifications_views.mark_notification_read,
        name='notifications_mark_read',
    ),
    path(
        'notifications/<int:pk>/',
        notifications_views.delete_notification,
        name='notifications_delete',
    ),
]