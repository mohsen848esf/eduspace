from django.urls import path, include
from rest_framework.routers import DefaultRouter
from notifications import views

router = DefaultRouter()
router.register(r'templates', views.TemplateViewSet, basename='template')

urlpatterns = [
    path('', views.list_in_app_notifications, name='notification-list'),
    path('read/', views.mark_notifications_read, name='notification-mark-read'),
    path('preferences/', views.notifications_preferences, name='notification-preferences'),
    path('classes/<int:class_id>/broadcast/', views.class_broadcast, name='class-broadcast-scoped'),
    path('<int:pk>/', views.delete_notification, name='notification-delete'),
    path('', include(router.urls)),
]
