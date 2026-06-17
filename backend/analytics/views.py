import csv
import logging
from collections import defaultdict
from django.db.models import Avg, Count, Sum
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import HasOrgPermission, resolve_organization
from accounts.models import (
    OrgMember, Course, AcademyClass, Session,
    Enrollment, Attendance, TuitionInvoice, ExpenseItem,
)
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
    Supported ?type= values: grades | financials | attendance
    """
    permission_classes = [IsAuthenticated, HasOrgPermission]
    required_org_permission = 'can_view_dashboard'

    def get(self, request):
        org = resolve_organization(request)
        if not org:
            return Response(
                {'detail': 'Organization context missing.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report_type = request.query_params.get('type')
        if not report_type:
            return Response(
                {'detail': 'Query parameter type (grades, financials, attendance) is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if report_type == 'grades':
            return self._export_grades(org)
        elif report_type == 'financials':
            return self._export_financials(org)
        elif report_type == 'attendance':
            return self._export_attendance(org)
        else:
            return Response(
                {'detail': f'Unsupported report type: {report_type}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # ------------------------------------------------------------------ #
    #  Private helpers                                                     #
    # ------------------------------------------------------------------ #

    def _export_grades(self, org):
        headers = [
            'Submission ID', 'Student Username', 'Student Email', 'Student Name',
            'Assessment Title', 'Status', 'Grade', 'Started At', 'Completed At', 'Focus Loss Count',
        ]

        def row_generator():
            yield headers
            try:
                from assessments.models import Submission
                submissions = (
                    Submission.objects
                    .filter(assessment__organization=org)
                    .select_related('student', 'assessment')
                    .order_by('-started_at')
                )
                for s in submissions:
                    yield [
                        s.id,
                        s.student.username,
                        s.student.email,
                        s.student.full_name,
                        s.assessment.title,
                        s.status,
                        str(s.grade) if s.grade is not None else 'N/A',
                        s.started_at.isoformat() if s.started_at else 'N/A',
                        s.completed_at.isoformat() if s.completed_at else 'N/A',
                        s.focus_loss_count,
                    ]
            except Exception as exc:
                logger.error('Failed during grades export: %s', exc)

        pseudo_buffer = Echo()
        writer = csv.writer(pseudo_buffer)
        response = StreamingHttpResponse(
            (writer.writerow(row) for row in row_generator()),
            content_type='text/csv',
        )
        response['Content-Disposition'] = (
            f'attachment; filename="grades_report_{org.slug}_{timezone.now().strftime("%Y%m%d")}.csv"'
        )
        return response

    def _export_financials(self, org):
        headers = [
            'ID', 'Record Type', 'Recipient/Student', 'Date Incurred', 'Status', 'Amount', 'Notes',
        ]

        def row_generator():
            yield headers
            for inv in (
                TuitionInvoice.objects
                .filter(organization=org)
                .select_related('student')
                .order_by('-created_at')
            ):
                yield [
                    f'INV-{inv.id}',
                    'Tuition Invoice',
                    inv.student.username,
                    inv.created_at.date().isoformat(),
                    inv.status,
                    str(inv.amount),
                    inv.notes or '',
                ]
            for exp in (
                ExpenseItem.objects
                .filter(organization=org)
                .select_related('recipient')
                .order_by('-incurred_at')
            ):
                yield [
                    f'EXP-{exp.id}',
                    'Expense Item',
                    exp.recipient.username if exp.recipient else 'N/A',
                    exp.incurred_at.date().isoformat() if exp.incurred_at else 'N/A',
                    'Approved' if exp.approved_by else 'Pending',
                    str(exp.amount),
                    exp.description or '',
                ]

        pseudo_buffer = Echo()
        writer = csv.writer(pseudo_buffer)
        response = StreamingHttpResponse(
            (writer.writerow(row) for row in row_generator()),
            content_type='text/csv',
        )
        response['Content-Disposition'] = (
            f'attachment; filename="financials_report_{org.slug}_{timezone.now().strftime("%Y%m%d")}.csv"'
        )
        return response

    def _export_attendance(self, org):
        headers = [
            'Session Title', 'Class Name', 'Student Username', 'Student Name',
            'Status', 'Joined At', 'Left At', 'Note',
        ]

        def row_generator():
            yield headers
            records = (
                Attendance.objects
                .filter(session__organization=org)
                .select_related('session', 'session__academy_class', 'student')
                .order_by('-session__scheduled_start')
            )
            for r in records:
                yield [
                    r.session.title,
                    r.session.academy_class.name if r.session.academy_class else 'Ad-hoc Session',
                    r.student.username,
                    r.student.full_name,
                    r.status,
                    r.joined_at.isoformat() if r.joined_at else 'N/A',
                    r.left_at.isoformat() if r.left_at else 'N/A',
                    r.note or '',
                ]

        pseudo_buffer = Echo()
        writer = csv.writer(pseudo_buffer)
        response = StreamingHttpResponse(
            (writer.writerow(row) for row in row_generator()),
            content_type='text/csv',
        )
        response['Content-Disposition'] = (
            f'attachment; filename="attendance_report_{org.slug}_{timezone.now().strftime("%Y%m%d")}.csv"'
        )
        return response


class AnalyticsSummaryView(APIView):
    """
    Endpoint returning dashboard-level summary analytics metrics.
    Includes course grade averages, staff session counts, and class completion rates
    for the H.7 multi-dimensional analytics dashboard.
    """
    permission_classes = [IsAuthenticated, HasOrgPermission]
    required_org_permission = 'can_view_dashboard'

    def get(self, request):
        org = resolve_organization(request)
        if not org:
            return Response(
                {'detail': 'Organization context missing.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 1. Active live sessions ────────────────────────────────────────── #
        active_sessions = AnalyticsCacheService.get_active_sessions(org.slug)
        if active_sessions is None:
            active_sessions = Session.objects.filter(
                organization=org, status=Session.Status.LIVE
            ).count()
            AnalyticsCacheService.set_active_sessions(org.slug, active_sessions)

        # ── 2. Active student headcount ───────────────────────────────────── #
        active_students = AnalyticsCacheService.get_active_students(org.slug)
        if active_students is None:
            active_students = OrgMember.objects.filter(
                organization=org, role__name='Student', is_active=True
            ).count()
            AnalyticsCacheService.set_active_students(org.slug, active_students)

        # ── 3. Exam submission overview ───────────────────────────────────── #
        total_submissions = 0
        average_grade = 0.0
        try:
            from assessments.models import Submission
            total_submissions = Submission.objects.filter(
                assessment__organization=org
            ).count()
            avg_result = Submission.objects.filter(
                assessment__organization=org,
                score__isnull=False,
            ).aggregate(avg_score=Avg('score'))['avg_score']
            average_grade = round(float(avg_result), 2) if avg_result is not None else 0.0
        except Exception:
            pass

        # ── 4. Quota & usage ─────────────────────────────────────────────── #
        quota = OrganizationQuota.objects.filter(organization=org).first()
        usage = OrganizationUsage.objects.filter(organization=org).first()

        quota_data = {
            'max_students': quota.max_students if quota else 100,
            'max_storage_gb': float(quota.max_storage_gb) if quota else 5.0,
            'max_recording_minutes': quota.max_recording_minutes if quota else 120,
        }
        usage_data = {
            'students_count': usage.students_count if usage else 0,
            'storage_used_gb': float(usage.storage_used_gb) if usage else 0.0,
            'recording_minutes_used': usage.recording_minutes_used if usage else 0,
        }

        # ── 5. Per-course average grades (homework submissions) ───────────── #
        course_averages = []
        try:
            from assessments.models import AssignmentSubmission
            for course in Course.objects.filter(organization=org, is_active=True):
                agg = AssignmentSubmission.objects.filter(
                    assignment__academy_class__course=course,
                    grade__isnull=False,
                ).aggregate(avg_grade=Avg('grade'), total=Count('id'))
                course_averages.append({
                    'id': course.id,
                    'code': course.code,
                    'title': course.title,
                    'avg_grade': round(float(agg['avg_grade']), 1) if agg['avg_grade'] else 0.0,
                    'graded_count': agg['total'] or 0,
                })
        except Exception:
            pass

        # ── 6. Staff hosted session counts ────────────────────────────────── #
        staff_session_counts = []
        try:
            staff_members = OrgMember.objects.filter(
                organization=org,
                is_active=True,
                role__name__in=['Teacher', 'Mentor', 'Admin'],
            ).select_related('user', 'role')
            for member in staff_members:
                count = Session.objects.filter(
                    organization=org,
                    host=member.user,
                    status__in=[Session.Status.COMPLETED, Session.Status.LIVE],
                ).count()
                staff_session_counts.append({
                    'user_id': member.user.id,
                    'full_name': member.user.full_name or member.user.username,
                    'role': member.role.name if member.role else 'Staff',
                    'session_count': count,
                })
        except Exception:
            pass

        # ── 7. Per-class homework completion rates ────────────────────────── #
        class_progress_rates = []
        try:
            from assessments.models import Assignment, AssignmentSubmission
            for cls in AcademyClass.objects.filter(
                course__organization=org, is_active=True
            ).select_related('course'):
                enrolled_count = Enrollment.objects.filter(
                    academy_class=cls, is_active=True
                ).count()
                total_assignments = Assignment.objects.filter(academy_class=cls).count()
                if total_assignments > 0 and enrolled_count > 0:
                    total_expected = total_assignments * enrolled_count
                    total_submitted = AssignmentSubmission.objects.filter(
                        assignment__academy_class=cls
                    ).count()
                    completion_rate = round((total_submitted / total_expected) * 100, 1)
                else:
                    total_expected = 0
                    total_submitted = 0
                    completion_rate = 0.0
                class_progress_rates.append({
                    'id': cls.id,
                    'name': cls.name,
                    'course_code': cls.course.code,
                    'enrolled_count': enrolled_count,
                    'total_assignments': total_assignments,
                    'total_submitted': total_submitted,
                    'completion_rate': completion_rate,
                })
        except Exception:
            pass

        # ── 8. Extended H.7 Metrics & KPIs ────────────────────────────────── #
        org_kpis = {}
        academic_kpis = {}
        at_risk_students = []
        teacher_analytics = []
        mentor_analytics = []
        course_analytics = []
        class_analytics = []

        try:
            from assessments.models import Assignment, AssignmentSubmission, Submission

            # Organization KPIs
            total_students = OrgMember.objects.filter(organization=org, role__name='Student', is_active=True).count()
            total_teachers = OrgMember.objects.filter(organization=org, role__name='Teacher', is_active=True).count()
            total_mentors = OrgMember.objects.filter(organization=org, role__name='Mentor', is_active=True).count()
            total_courses = Course.objects.filter(organization=org, is_active=True).count()
            total_classes = AcademyClass.objects.filter(course__organization=org, is_active=True).count()
            total_sessions_all = Session.objects.filter(organization=org).count()

            org_kpis = {
                'total_students': total_students,
                'total_teachers': total_teachers,
                'total_mentors': total_mentors,
                'total_courses': total_courses,
                'total_classes': total_classes,
                'total_sessions': total_sessions_all,
            }

            # Gather data for Student Analytics
            active_student_members = OrgMember.objects.filter(
                organization=org, role__name='Student', is_active=True
            ).select_related('user')
            student_users = [member.user for member in active_student_members]

            enrollments = Enrollment.objects.filter(
                academy_class__course__organization=org, student__in=student_users, is_active=True
            ).select_related('academy_class')
            
            assignments = Assignment.objects.filter(
                academy_class__course__organization=org
            ).select_related('academy_class')
            
            submissions = AssignmentSubmission.objects.filter(
                assignment__academy_class__course__organization=org, student__in=student_users
            ).select_related('assignment')
            
            attendance = Attendance.objects.filter(
                session__organization=org, student__in=student_users
            ).select_related('session')

            # Build maps
            student_classes = {u.id: set() for u in student_users}
            for e in enrollments:
                if e.student_id in student_classes:
                    student_classes[e.student_id].add(e.academy_class_id)

            class_assignments = defaultdict(list)
            for a in assignments:
                class_assignments[a.academy_class_id].append(a.id)

            student_submissions = {u.id: {} for u in student_users}
            for s in submissions:
                if s.student_id in student_submissions:
                    student_submissions[s.student_id][s.assignment_id] = s

            student_attendance = {u.id: [] for u in student_users}
            for att in attendance:
                if att.student_id in student_attendance:
                    student_attendance[att.student_id].append(att.status)

            all_students_assignment_grades = []
            overall_expected = 0
            overall_submitted = 0
            at_risk_students_count = 0
            student_missing_map = {}
            at_risk_ids = set()

            for member in active_student_members:
                user = member.user
                class_ids = student_classes.get(user.id, set())

                expected_assignment_ids = []
                for cid in class_ids:
                    expected_assignment_ids.extend(class_assignments.get(cid, []))

                subs = student_submissions.get(user.id, {})
                submitted_count = sum(1 for aid in expected_assignment_ids if aid in subs)
                expected_count = len(expected_assignment_ids)

                overall_expected += expected_count
                overall_submitted += submitted_count

                missing_count = expected_count - submitted_count
                student_missing_map[user.id] = missing_count

                # Average assignment grade
                graded_grades = [float(subs[aid].grade) for aid in expected_assignment_ids if aid in subs and subs[aid].grade is not None]
                if graded_grades:
                    avg_grade = sum(graded_grades) / len(graded_grades)
                    all_students_assignment_grades.extend(graded_grades)
                else:
                    avg_grade = None

                # Attendance rate
                att_list = student_attendance.get(user.id, [])
                if att_list:
                    attended_count = sum(1 for status in att_list if status in ['present', 'late', 'excused'])
                    attendance_rate = (attended_count / len(att_list)) * 100
                else:
                    attendance_rate = 100.0

                # Risk check
                risk_flags = []
                if attendance_rate < 75.0:
                    risk_flags.append('low_attendance')
                if missing_count > 0:
                    risk_flags.append('missing_assignments')
                if avg_grade is not None and avg_grade < 60.0:
                    risk_flags.append('poor_grades')

                if risk_flags:
                    at_risk_students_count += 1
                    at_risk_ids.add(user.id)
                    at_risk_students.append({
                        'user_id': user.id,
                        'username': user.username,
                        'full_name': user.full_name or user.username,
                        'attendance_rate': round(attendance_rate, 1),
                        'missing_assignments_count': missing_count,
                        'avg_grade': round(avg_grade, 1) if avg_grade is not None else None,
                        'risk_flags': risk_flags
                    })

            # Calculate academic KPIs
            overall_completion_rate = (overall_submitted / overall_expected * 100) if overall_expected > 0 else 100.0
            
            overall_present = Attendance.objects.filter(session__organization=org, status__in=['present', 'late', 'excused']).count()
            overall_total = Attendance.objects.filter(session__organization=org).count()
            overall_attendance_rate = (overall_present / overall_total * 100) if overall_total > 0 else 100.0

            overall_assignment_avg = sum(all_students_assignment_grades) / len(all_students_assignment_grades) if all_students_assignment_grades else 0.0

            academic_kpis = {
                'assignment_completion_rate': round(overall_completion_rate, 1),
                'attendance_rate': round(overall_attendance_rate, 1),
                'average_grade': average_grade,
                'average_assignment_grade': round(overall_assignment_avg, 1),
                'active_students': total_students,
                'at_risk_students_count': at_risk_students_count,
            }

            # Map classes to students
            class_students_map = defaultdict(set)
            for e in enrollments:
                class_students_map[e.academy_class_id].add(e.student_id)

            # Teacher Analytics
            teacher_members = OrgMember.objects.filter(
                organization=org, role__name='Teacher', is_active=True
            ).select_related('user')
            
            teacher_classes = AcademyClass.objects.filter(
                course__organization=org, teacher__in=[t.user for t in teacher_members], is_active=True
            ).select_related('teacher')
            
            teacher_classes_map = defaultdict(list)
            for cls in teacher_classes:
                teacher_classes_map[cls.teacher_id].append(cls)

            teacher_sessions = Session.objects.filter(
                organization=org, host__in=[t.user for t in teacher_members]
            ).values('host_id').annotate(count=Count('id'))
            teacher_sessions_map = {item['host_id']: item['count'] for item in teacher_sessions}

            pending_submissions = AssignmentSubmission.objects.filter(
                assignment__academy_class__course__organization=org,
                assignment__academy_class__teacher__in=[t.user for t in teacher_members],
                grade__isnull=True
            ).select_related('assignment__academy_class')
            teacher_pending_map = defaultdict(int)
            for sub in pending_submissions:
                t_id = sub.assignment.academy_class.teacher_id
                if t_id:
                    teacher_pending_map[t_id] += 1

            for tm in teacher_members:
                t_user = tm.user
                t_clses = teacher_classes_map.get(t_user.id, [])
                t_student_ids = set()
                for cls in t_clses:
                    t_student_ids.update(class_students_map.get(cls.id, set()))

                teacher_analytics.append({
                    'user_id': t_user.id,
                    'full_name': t_user.full_name or t_user.username,
                    'classes_count': len(t_clses),
                    'students_count': len(t_student_ids),
                    'sessions_count': teacher_sessions_map.get(t_user.id, 0),
                    'pending_reviews': teacher_pending_map.get(t_user.id, 0),
                })

            # Mentor Analytics
            mentor_members = OrgMember.objects.filter(
                organization=org, role__name='Mentor', is_active=True
            ).select_related('user')
            
            mentor_classes = AcademyClass.objects.filter(
                course__organization=org, mentor__in=[m.user for m in mentor_members], is_active=True
            ).select_related('mentor')
            
            mentor_classes_map = defaultdict(list)
            for cls in mentor_classes:
                mentor_classes_map[cls.mentor_id].append(cls)

            for mm in mentor_members:
                m_user = mm.user
                m_clses = mentor_classes_map.get(m_user.id, [])
                m_student_ids = set()
                for cls in m_clses:
                    m_student_ids.update(class_students_map.get(cls.id, set()))

                at_risk_mentored_count = sum(1 for sid in m_student_ids if sid in at_risk_ids)
                follow_up_workload = sum(student_missing_map.get(sid, 0) for sid in m_student_ids)

                mentor_analytics.append({
                    'user_id': m_user.id,
                    'full_name': m_user.full_name or m_user.username,
                    'students_count': len(m_student_ids),
                    'active_relationships': len(m_clses),
                    'at_risk_count': at_risk_mentored_count,
                    'follow_up_workload': follow_up_workload,
                })

            # Course Analytics
            courses = Course.objects.filter(organization=org, is_active=True)
            for course in courses:
                course_classes = AcademyClass.objects.filter(course=course, is_active=True)
                c_class_ids = [c.id for c in course_classes]
                
                c_student_ids = set()
                for cid in c_class_ids:
                    c_student_ids.update(class_students_map.get(cid, set()))

                # Course Completion rate
                c_rates = []
                for cid in c_class_ids:
                    enrolled_cnt = len(class_students_map.get(cid, set()))
                    total_a = len(class_assignments.get(cid, []))
                    if total_a > 0 and enrolled_cnt > 0:
                        total_expected = total_a * enrolled_cnt
                        total_submitted = AssignmentSubmission.objects.filter(assignment__academy_class_id=cid).count()
                        c_rates.append((total_submitted / total_expected) * 100)
                    else:
                        c_rates.append(100.0 if enrolled_cnt > 0 else 0.0)
                completion_rate = round(sum(c_rates) / len(c_rates), 1) if c_rates else 100.0

                # Revenue generated
                rev_agg = TuitionInvoice.objects.filter(
                    academy_class__in=course_classes, status='paid'
                ).aggregate(total=Sum('amount'))['total'] or 0.0

                # Attendance average
                c_att_total = Attendance.objects.filter(session__academy_class__in=course_classes).count()
                c_att_present = Attendance.objects.filter(
                    session__academy_class__in=course_classes, status__in=['present', 'late', 'excused']
                ).count()
                attendance_average = round((c_att_present / c_att_total) * 100, 1) if c_att_total > 0 else 100.0

                # Average assignment grade
                c_grade_agg = AssignmentSubmission.objects.filter(
                    assignment__academy_class__in=course_classes, grade__isnull=False
                ).aggregate(avg=Avg('grade'))['avg']
                avg_grade = round(float(c_grade_agg), 1) if c_grade_agg is not None else 0.0

                course_analytics.append({
                    'id': course.id,
                    'code': course.code,
                    'title': course.title,
                    'enrollment_count': len(c_student_ids),
                    'completion_rate': completion_rate,
                    'revenue_generated': float(rev_agg),
                    'attendance_average': attendance_average,
                    'avg_grade': avg_grade,
                })

            # Class Analytics
            all_active_classes = AcademyClass.objects.filter(course__organization=org, is_active=True).select_related('course')
            for cls in all_active_classes:
                student_ids = class_students_map.get(cls.id, set())
                student_count = len(student_ids)

                recent_sessions = Session.objects.filter(academy_class=cls).order_by('-scheduled_start', '-created_at')[:5]
                attendance_trend = []
                for sess in reversed(recent_sessions):
                    sess_att_total = Attendance.objects.filter(session=sess).count()
                    sess_att_present = Attendance.objects.filter(
                        session=sess, status__in=['present', 'late', 'excused']
                    ).count()
                    rate = round((sess_att_present / sess_att_total) * 100, 1) if sess_att_total > 0 else 100.0
                    attendance_trend.append({
                        'session_id': sess.id,
                        'title': sess.title,
                        'rate': rate,
                        'scheduled_start': sess.scheduled_start.isoformat() if sess.scheduled_start else None
                    })

                total_a = len(class_assignments.get(cls.id, []))
                if total_a > 0 and student_count > 0:
                    total_expected = total_a * student_count
                    total_submitted = AssignmentSubmission.objects.filter(assignment__academy_class=cls).count()
                    cls_completion_rate = round((total_submitted / total_expected) * 100, 1)
                else:
                    cls_completion_rate = 0.0

                paid_rev = TuitionInvoice.objects.filter(academy_class=cls, status='paid').aggregate(total=Sum('amount'))['total'] or 0.0
                outstanding_rev = TuitionInvoice.objects.filter(
                    academy_class=cls, status__in=['unpaid', 'partial', 'overdue']
                ).aggregate(total=Sum('amount'))['total'] or 0.0

                class_analytics.append({
                    'id': cls.id,
                    'name': cls.name,
                    'course_code': cls.course.code,
                    'student_count': student_count,
                    'attendance_trend': attendance_trend,
                    'assignment_completion': cls_completion_rate,
                    'revenue_summary': {
                        'paid': float(paid_rev),
                        'outstanding': float(outstanding_rev),
                    }
                })

        except Exception as e:
            logger.error("Error computing H.7 Analytics complete view: %s", str(e), exc_info=True)

        data = {
            'active_sessions': active_sessions,
            'active_students': active_students,
            'total_submissions': total_submissions,
            'average_grade': average_grade,
            'quota': quota_data,
            'usage': usage_data,
            'course_averages': course_averages,
            'staff_session_counts': staff_session_counts,
            'class_progress_rates': class_progress_rates,
            # Complete H.7 extended data
            'org_kpis': org_kpis,
            'academic_kpis': academic_kpis,
            'at_risk_students': at_risk_students,
            'teacher_analytics': teacher_analytics,
            'mentor_analytics': mentor_analytics,
            'course_analytics': course_analytics,
            'class_analytics': class_analytics,
            'timestamp': timezone.now().isoformat(),
        }

        return Response(data, status=status.HTTP_200_OK)
