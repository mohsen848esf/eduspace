from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/games/', include('games.urls')),
    path('api/rooms/', include('rooms.urls')),
]