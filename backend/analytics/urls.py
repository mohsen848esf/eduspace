from django.urls import path
from analytics.views import AcademicReportExportView, AnalyticsSummaryView

urlpatterns = [
    path('reports/export/', AcademicReportExportView.as_view(), name='academic-reports-export'),
    path('summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
]
