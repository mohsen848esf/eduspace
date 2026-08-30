from django.urls import path, include
from rest_framework.routers import DefaultRouter
from sys_admin import views

router = DefaultRouter()
router.register('organizations', views.OrganizationAdminViewSet, basename='org-admin')
router.register('configs', views.SystemConfigViewSet, basename='config-admin')
router.register('audit-logs', views.OperatorAuditLogViewSet, basename='audit-log-admin')

urlpatterns = [
    path('dashboard/metrics/', views.sys_admin_dashboard_metrics, name='sys-admin-dashboard-metrics'),
    path('', include(router.urls)),
]
