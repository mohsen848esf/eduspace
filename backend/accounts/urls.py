from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import notifications as notifications_views

router = DefaultRouter()
router.register('courses', views.CourseViewSet, basename='course')
router.register('classes', views.AcademyClassViewSet, basename='class')
router.register('enrollments', views.EnrollmentViewSet, basename='enrollment')
router.register('invoices', views.TuitionInvoiceViewSet, basename='invoice')
router.register('expenses', views.ExpenseItemViewSet, basename='expense')
router.register('sessions', views.SessionViewSet, basename='session')
router.register('attendance', views.AttendanceViewSet, basename='attendance')
router.register('organizations', views.OrganizationViewSet, basename='organization')
router.register('org-members', views.OrgMemberViewSet, basename='org-member')
router.register('roles', views.RoleViewSet, basename='role')
router.register('certificates', views.CertificateViewSet, basename='certificate')

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('me/', views.me, name='me'),
    path('logout/', views.logout, name='logout'),
    path('search/', views.search_users, name='search_users'),
    path('search/global/', views.global_search, name='global_search'),

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

    path('org-context/', views.org_context, name='org_context'),

    # CRM and Financial API ViewSets
    path('', include(router.urls)),
]