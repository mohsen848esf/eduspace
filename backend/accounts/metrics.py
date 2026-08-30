from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from django.http import HttpResponse

# API Metrics
HTTP_REQUESTS_TOTAL = Counter(
    'http_requests_total',
    'Total HTTP Requests',
    ['method', 'endpoint', 'status_code']
)
HTTP_REQUEST_LATENCY_SECONDS = Histogram(
    'http_request_latency_seconds',
    'HTTP Request Latency in seconds',
    ['method', 'endpoint']
)

# Background Jobs Metrics
CELERY_TASKS_TOTAL = Counter(
    'celery_tasks_total',
    'Total Celery Tasks Executed',
    ['task_name', 'status']
)

# Business Metrics
ACTIVE_USERS_GAUGE = Gauge(
    'active_users',
    'Number of active users'
)
ACTIVE_ORGANIZATIONS_GAUGE = Gauge(
    'active_organizations',
    'Number of active organizations'
)
RUNNING_SESSIONS_GAUGE = Gauge(
    'running_sessions',
    'Number of currently running/live sessions'
)
ASSESSMENTS_IN_PROGRESS_GAUGE = Gauge(
    'assessments_in_progress',
    'Number of assessments in progress'
)

def metrics_view(request):
    # Dynamic business metrics calculation
    from accounts.models import User, Organization, Session
    from assessments.models import Submission
    
    try:
        ACTIVE_USERS_GAUGE.set(User.objects.filter(is_active=True).count())
        ACTIVE_ORGANIZATIONS_GAUGE.set(Organization.objects.filter(is_active=True).count())
        RUNNING_SESSIONS_GAUGE.set(Session.objects.filter(status='live').count())
        ASSESSMENTS_IN_PROGRESS_GAUGE.set(Submission.objects.filter(status='started').count())
    except Exception:
        pass
        
    return HttpResponse(generate_latest(), content_type=CONTENT_TYPE_LATEST)
