from django.urls import path
from accounts.system_views import health_check
from accounts.metrics import metrics_view

urlpatterns = [
    path('health/', health_check, name='system-health'),
    path('metrics/', metrics_view, name='system-metrics'),
]
