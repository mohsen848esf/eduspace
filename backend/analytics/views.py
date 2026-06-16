import csv
import logging
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import HasOrgPermission, resolve_organization
from accounts.models import OrgMember, Course, AcademyClass, Session, Enrollment, Attendance, TuitionInvoice, ExpenseItem
from sys_admin.models import OrganizationQuota, OrganizationUsage
from analytics.services.cache_service import AnalyticsCacheService

logger = logging.getLogger(__name__)

class Echo:
    """
    An object that implements just the write method of the file-like interface.
    Used for streaming CSV generation dynamically.
    """
    def write(self, value):
        return value


class AcademicReportExportView(APIView):
    """
    API view to export academic, financial, or attendance logs as CSV file streams.
    Requires can_view_dashboard organization permissions.
    """
    permission_classes = [IsAuthenticated, HasOrgPermission]
    required_org_permission = 'can_view_dashboard'

    def get(self, request):
        org = resolve_organization(request)
        if not org:
            return Response({'detail': 'Organization context missing.'}, status=status.HTTP_400_BAD_REQUEST)

        report_type = request.query_params.get('type')
        if not report_type:
            return Response({'detail': 'Query parameter type (grades, financials, attendance) is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if report_type == 'grades':
            return self._export_grades(org)
        elif report_type == 'financials':
            return self._export_financials(org)
        elif report_type == 'attendance':
            return self._export_attendance(org)
        else:
            return Response({'detail': f'Unsupported report type: {report_type}'}, status=status.HTTP_400_BAD_REQUEST)

    def _export_grades(self, org):
        # Header columns
        headers = [
            'Submission ID', 'Student Username', 'Student Email', 'Student Name',
            'Assessment Title', 'Status', 'Grade', 'Started At', 'Completed At', 'Focus Loss Count'
        ]

        def row_generator():
            yield Echo().write(headers)
            try:
                from assessments.models import Submission
                submissions = Submission.objects.filter(
                    assessment__organization=org
                ).select_related('student', 'assessment').order_by('-started_at')
                
                for s in submissions:
                    row = [
                        s.id,
                        s.student.username,
                        s.student.email,
                        s.student.full_name,
                        s.assessment.title,
                        s.status,
                        str(s.grade) if s.grade is not None else 'N/A',
                        s.started_at.isoformat() if s.started_at else 'N/A',
                        s.completed_at.isoformat() if s.completed_at else 'N/A',
                        s.focus_loss_count
                    ]
                    yield Echo().write(row)
            except Exception as e:
                logger.error(f"Failed during grades export rows generation: {e}")
                yield Echo().write(['Error generating report rows'])

        pseudo_buffer = Echo()
        writer = csv.writer(pseudo_buffer)
        
        response = StreamingHttpResponse(
            (writer.writerow(row) for row in row_generator()),
            content_type="text/csv"
        )
        response['Content-Disposition'] = f'attachment; filename="grades_report_{org.slug}_{timezone.now().strftime("%Y%m%d")}.csv"'
        return response

    def _export_financials(self, org):
        headers = [
            'ID', 'Record Type', 'Recipient/Student', 'Date Incurred', 'Status', 'Amount', 'Notes'
        ]

        def row_generator():
            yield Echo().write(headers)
            
            # Fetch invoices
            invoices = TuitionInvoice.objects.filter(organization=org).select_related('student').order_by('-created_at')
            for inv in invoices:
                row = [
                    f"INV-{inv.id}",
                    "Tuition Invoice",
                    inv.student.username,
                    inv.created_at.date().isoformat(),
                    inv.status,
                    str(inv.amount),
                    inv.notes
                ]
                yield Echo().write(row)

            # Fetch expenses
            expenses = ExpenseItem.objects.filter(organization=org).select_related('recipient').order_by('-incurred_at')
            for exp in expenses:
                row = [
                    f"EXP-{exp.id}",
                    "Expense Item",
                    exp.recipient.username if exp.recipient else "N/A",
                    exp.incurred_at.date().isoformat() if exp.incurred_at else 'N/A',
                    "Approved" if exp.approved_by else "Pending",
                    str(exp.amount),
                    exp.description
                ]
                yield Echo().write(row)

        pseudo_buffer = Echo()
        writer = csv.writer(pseudo_buffer)
        
        response = StreamingHttpResponse(
            (writer.writerow(row) for row in row_generator()),
            content_type="text/csv"
        )
        response['Content-Disposition'] = f'attachment; filename="financials_report_{org.slug}_{timezone.now().strftime("%Y%m%d")}.csv"'
        return response

    def _export_attendance(self, org):
        headers = [
            'Session Title', 'Class Name', 'Student Username', 'Student Name', 'Status', 'Joined At', 'Left At', 'Note'
        ]

        def row_generator():
            yield Echo().write(headers)
            
            records = Attendance.objects.filter(
                session__organization=org
            ).select_related('session', 'session__academy_class', 'student').order_by('-session__scheduled_start')
            
            for r in records:
                row = [
                    r.session.title,
                    r.session.academy_class.name if r.session.academy_class else "Ad-hoc Session",
                    r.student.username,
                    r.student.full_name,
                    r.status,
                    r.joined_at.isoformat() if r.joined_at else 'N/A',
                    r.left_at.isoformat() if r.left_at else 'N/A',
                    r.note
                ]
                yield Echo().write(row)

        pseudo_buffer = Echo()
        writer = csv.writer(pseudo_buffer)
        
        response = StreamingHttpResponse(
            (writer.writerow(row) for row in row_generator()),
            content_type="text/csv"
        )
        response['Content-Disposition'] = f'attachment; filename="attendance_report_{org.slug}_{timezone.now().strftime("%Y%m%d")}.csv"'
        return response


class AnalyticsSummaryView(APIView):
    """
    Endpoint returning dashboard-level summary analytics metrics, utilizing
    cached results where appropriate via AnalyticsCacheService.
    """
    permission_classes = [IsAuthenticated, HasOrgPermission]
    required_org_permission = 'can_view_dashboard'

    def get(self, request):
        org = resolve_organization(request)
        if not org:
            return Response({'detail': 'Organization context missing.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Active sessions check
        active_sessions = AnalyticsCacheService.get_active_sessions(org.slug)
        if active_sessions is None:
            active_sessions = Session.objects.filter(organization=org, status=Session.Status.LIVE).count()
            AnalyticsCacheService.set_active_sessions(org.slug, active_sessions)

        # 2. Active students
        active_students = AnalyticsCacheService.get_active_students(org.slug)
        if active_students is None:
            active_students = OrgMember.objects.filter(organization=org, role__name='Student', is_active=True).count()
            AnalyticsCacheService.set_active_students(org.slug, active_students)

        # 3. Overall submissions counts and average grades
        total_submissions = 0
        average_grade = 0.0
        try:
            from assessments.models import Submission
            from django.db.models import Avg
            total_submissions = Submission.objects.filter(assessment__organization=org).count()
            avg_result = Submission.objects.filter(
                assessment__organization=org, 
                grade__isnull=False
            ).aggregate(avg_score=Avg('grade'))['avg_score']
            average_grade = round(float(avg_result), 2) if avg_result is not None else 0.0
        except Exception:
            pass

        # 4. Quotas summary info
        quota = OrganizationQuota.objects.filter(organization=org).first()
        usage = OrganizationUsage.objects.filter(organization=org).first()

        quota_data = {
            "max_students": quota.max_students if quota else 100,
            "max_storage_gb": float(quota.max_storage_gb) if quota else 5.0,
            "max_recording_minutes": quota.max_recording_minutes if quota else 120,
        }
        
        usage_data = {
            "students_count": usage.students_count if usage else 0,
            "storage_used_gb": float(usage.storage_used_gb) if usage else 0.0,
            "recording_minutes_used": usage.recording_minutes_used if usage else 0,
        }

        data = {
            "active_sessions": active_sessions,
            "active_students": active_students,
            "total_submissions": total_submissions,
            "average_grade": average_grade,
            "quota": quota_data,
            "usage": usage_data,
            "timestamp": timezone.now().isoformat()
        }

        return Response(data, status=status.HTTP_200_OK)
