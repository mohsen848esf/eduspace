from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from notifications import views as notifications_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/games/', include('games.urls')),
    path('api/rooms/', include('rooms.urls')),
    path('api/rooms/', include('media_library.room_urls')),
    path('api/media/', include('media_library.urls')),
    path('api/recordings/', include('rooms.recording_urls')),
    path('api/assessments/', include('assessments.urls')),
    path('api/system/', include('accounts.system_urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/sys-admin/', include('sys_admin.urls')),
    path('api/billing/', include('billing.urls')),
    path('api/analytics/', include('analytics.urls')),
    path('api/accounts/preferences/notifications/', notifications_views.notifications_preferences),
    path('api/classes/<int:class_id>/broadcast/', notifications_views.class_broadcast),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

