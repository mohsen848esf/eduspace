from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import (
    Organization, Course, AcademyClass, Enrollment, TuitionInvoice, ExpenseItem, OrgMember, Role, Permission, Session
)

User = get_user_model()

class CRMViewsIntegrationTest(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        # Create user
        self.user = User.objects.create_user(username='crm_user', password='password')
        # Create organization with user as owner
        self.org = Organization.objects.create(name='CRM Org', slug='crm-org', owner=self.user)
        
        # Add permissions
        self.perm_view, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        self.perm_manage, _ = Permission.objects.get_or_create(codename='can_manage_members', defaults={'name': 'Manage Members'})
        self.perm_financials_view, _ = Permission.objects.get_or_create(codename='can_view_financials', defaults={'name': 'View Financials'})
        self.perm_financials_manage, _ = Permission.objects.get_or_create(codename='can_manage_financials', defaults={'name': 'Manage Financials'})
        
        # Create roles
        self.admin_role = Role.objects.create(name='CRM Admin', organization=self.org)
        self.admin_role.permissions.add(self.perm_view, self.perm_manage, self.perm_financials_view, self.perm_financials_manage)
        
        # Make user a member with admin role
        self.member = OrgMember.objects.create(
            organization=self.org,
            user=self.user,
            role=self.admin_role
        )
        
        self.client.force_authenticate(user=self.user)

    def test_course_viewset_filtering_and_auto_populate(self):
        # 1. Create active and inactive courses
        c1 = Course.objects.create(title='Active Course', code='AC101', organization=self.org, is_active=True)
        c2 = Course.objects.create(title='Archived Course', code='ARC101', organization=self.org, is_active=False)
        
        url = reverse('course-list')
        
        # 2. Get course list (default should not include archived)
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], c1.id)
        
        # 3. Get course list including archived
        res = self.client.get(f"{url}?include_archived=true", HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)
        
        # 4. Create new Course via POST API, verify created_by is auto-populated
        post_data = {
            'title': 'New Class Course',
            'code': 'NCC101',
            'price': '150.00',
            'is_active': True
        }
        res = self.client.post(url, post_data, format='json', HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['created_by'], self.user.id)
        self.assertEqual(res.data['is_active'], True)
        
        # Ensure it exists in db
        new_course = Course.objects.get(code='NCC101')
        self.assertEqual(new_course.created_by, self.user)

    def test_academy_class_viewset_filtering_and_auto_populate(self):
        course = Course.objects.create(title='Base Course', code='BC101', organization=self.org)
        
        ac1 = AcademyClass.objects.create(course=course, name='Class 1', is_active=True)
        ac2 = AcademyClass.objects.create(course=course, name='Class 2', is_active=False)
        
        url = reverse('class-list')
        
        # 1. Get default list
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], ac1.id)
        
        # 2. Get list with include_archived=true
        res = self.client.get(f"{url}?include_archived=true", HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)
        
        # 3. Create via POST
        post_data = {
            'course': course.id,
            'name': 'Class 3',
            'max_students': 30
        }
        res = self.client.post(url, post_data, format='json', HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['created_by'], self.user.id)
        self.assertEqual(res.data['max_students'], 30)

    def test_academy_class_session_fields_and_room_sync(self):
        from rooms.models import Room
        course = Course.objects.create(title='Base Course', code='BC101', organization=self.org)
        ac = AcademyClass.objects.create(course=course, name='Class A')
        
        # 1. Create a session
        session = Session.objects.create(
            academy_class=ac,
            host=self.user,
            title='Session 1',
            status=Session.Status.SCHEDULED,
            scheduled_start=timezone.now()
        )
        
        url = reverse('class-detail', args=[ac.id])
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        # Verify compatibility fields
        self.assertEqual(res.data['session_count'], 1)
        self.assertIsNotNone(res.data['latest_session'])
        self.assertEqual(res.data['latest_session']['id'], session.id)
        self.assertEqual(res.data['latest_session']['status'], 'scheduled')
        self.assertIsNone(res.data['room']) # No active room yet
        
        # 2. Create room and start live (sets active_room)
        room = Room.objects.create(name='Live Room', room_code='LIV101', host=self.user)
        session.active_room = room
        session.save()
        
        # Class room FK should be synced in save hook
        ac.refresh_from_db()
        self.assertEqual(ac.room, room)
        
        # Verify via API response
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.data['room'], room.id)
        
        # 3. Nullify active_room and save
        session.active_room = None
        session.save()
        
        ac.refresh_from_db()
        self.assertIsNone(ac.room)
        
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertIsNone(res.data['room'])

    def test_enrollment_viewset_filtering_and_auto_populate(self):
        course = Course.objects.create(title='Base Course', code='BC101', organization=self.org)
        ac = AcademyClass.objects.create(course=course, name='Class 1')
        student1 = User.objects.create_user(username='student1', password='password')
        student2 = User.objects.create_user(username='student2', password='password')
        
        e1 = Enrollment.objects.create(academy_class=ac, student=student1, is_active=True)
        e2 = Enrollment.objects.create(academy_class=ac, student=student2, is_active=False)
        
        url = reverse('enrollment-list')
        
        # 1. Get default list
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], e1.id)
        
        # 2. Get list with include_archived=true
        res = self.client.get(f"{url}?include_archived=true", HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)
        
        # 3. Create via POST
        student3 = User.objects.create_user(username='student3', password='password')
        post_data = {
            'academy_class': ac.id,
            'student': student3.id,
            'completion_status': 'in_progress'
        }
        res = self.client.post(url, post_data, format='json', HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['enrolled_by'], self.user.id)
        self.assertEqual(res.data['completion_status'], 'in_progress')

    def test_tuition_invoice_viewset_and_sequential_number(self):
        student = User.objects.create_user(username='student_fin', password='password')
        
        url = reverse('invoice-list')
        
        # 1. Create first invoice via API
        post_data_1 = {
            'student': student.id,
            'amount': '250.00',
            'payment_method': 'cash',
            'notes': 'First payment notes'
        }
        res = self.client.post(url, post_data_1, format='json', HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['issued_by'], self.user.id)
        self.assertEqual(res.data['payment_method'], 'cash')
        self.assertEqual(res.data['notes'], 'First payment notes')
        self.assertEqual(res.data['invoice_number'], f"INV-{self.org.id}-0001")
        
        # 2. Create second invoice via API
        post_data_2 = {
            'student': student.id,
            'amount': '500.00',
            'payment_method': 'bank_transfer'
        }
        res = self.client.post(url, post_data_2, format='json', HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['invoice_number'], f"INV-{self.org.id}-0002")

    def test_expense_item_viewset_and_auto_populate(self):
        recipient = User.objects.create_user(username='teacher_exp', password='password')
        url = reverse('expense-list')
        
        # Create expense item via API
        post_data = {
            'amount': '300.00',
            'category': 'teacher_payout',
            'description': 'Payout for May',
            'recipient': recipient.id
        }
        res = self.client.post(url, post_data, format='json', HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['approved_by'], self.user.id)
        self.assertEqual(res.data['category'], 'teacher_payout')
        self.assertEqual(res.data['description'], 'Payout for May')

    def test_student_enrollment_isolation(self):
        # Create student user
        student_user = User.objects.create_user(username='student_user', password='password')
        # Assign student role (student user doesn't have custom roles or is_superuser)
        student_role = Role.objects.create(name='Student Role 1', organization=self.org)
        student_role.permissions.add(self.perm_view)
        student_member = OrgMember.objects.create(
            organization=self.org,
            user=student_user,
            role=student_role
        )
        
        course = Course.objects.create(title='Isolated Course', code='IC101', organization=self.org)
        ac = AcademyClass.objects.create(course=course, name='Class 1')
        
        # Enrollment for student_user
        e_student = Enrollment.objects.create(academy_class=ac, student=student_user)
        # Enrollment for another user
        another_user = User.objects.create_user(username='another_user', password='password')
        e_another = Enrollment.objects.create(academy_class=ac, student=another_user)
        
        # Authenticate as student_user
        self.client.force_authenticate(user=student_user)
        url = reverse('enrollment-list')
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Student should only see 1 enrollment (their own)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], e_student.id)

    def test_student_invoice_isolation(self):
        student_user = User.objects.create_user(username='student_user_2', password='password')
        student_role = Role.objects.create(name='Student Role 2', organization=self.org)
        student_role.permissions.add(self.perm_view)
        student_member = OrgMember.objects.create(
            organization=self.org,
            user=student_user,
            role=student_role
        )
        
        # Invoices
        inv_student = TuitionInvoice.objects.create(organization=self.org, student=student_user, amount=100)
        another_user = User.objects.create_user(username='another_user_2', password='password')
        inv_another = TuitionInvoice.objects.create(organization=self.org, student=another_user, amount=200)
        
        # Authenticate as student
        self.client.force_authenticate(user=student_user)
        url = reverse('invoice-list')
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Student should only see their own invoice
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], inv_student.id)

    def test_expense_denied_without_permission(self):
        regular_user = User.objects.create_user(username='regular_user', password='password')
        # Member with a teacher role (can_view_dashboard, can_teach_class but not financials)
        teacher_role = Role.objects.create(name='CRM Teacher', organization=self.org)
        teacher_role.permissions.add(self.perm_view)
        
        OrgMember.objects.create(
            organization=self.org,
            user=regular_user,
            role=teacher_role
        )
        
        ExpenseItem.objects.create(organization=self.org, amount=100)
        
        # Authenticate as regular_user
        self.client.force_authenticate(user=regular_user)
        url = reverse('expense-list')
        res = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='crm-org')
        # Without financials view permission, views.py get_permissions returns 'can_view_financials' as required
        # which denies permission at the HasOrgPermission layer (HTTP 403)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_crm_spoofing_and_cross_tenant_creation_rejected(self):
        # Create a second organization belonging to another user
        other_user = User.objects.create_user(username='other_user', password='password')
        other_org = Organization.objects.create(name='Other Org', slug='other-org', owner=other_user)
        other_course = Course.objects.create(title='Other Course', code='OC101', organization=other_org)
        other_class = AcademyClass.objects.create(course=other_course, name='Other Class')

        # Scenario A: Organization spoofing and created_by spoofing in Course creation
        url = reverse('course-list')
        post_data = {
            'title': 'Spoof Course',
            'code': 'SPC101',
            'price': '100.00',
            'organization': other_org.id,  # Attempting to spoof organization
            'created_by': other_user.id    # Attempting to spoof created_by
        }
        res = self.client.post(url, post_data, format='json', HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        
        # Verify the spoofed organization was ignored and set to self.org
        course = Course.objects.get(code='SPC101')
        self.assertEqual(course.organization, self.org)
        # Verify the spoofed created_by was ignored and set to self.user
        self.assertEqual(course.created_by, self.user)

        # Scenario B: Cross-tenant creation is rejected (e.g. creating class with course from other org)
        class_url = reverse('class-list')
        post_class_data = {
            'course': other_course.id,  # Foreign course belonging to other_org
            'name': 'Invalid Class'
        }
        res_class = self.client.post(class_url, post_class_data, format='json', HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res_class.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('course', res_class.data)

        # Scenario C: Cross-tenant enrollment is rejected (enrolling to class from other org)
        enroll_url = reverse('enrollment-list')
        post_enroll_data = {
            'academy_class': other_class.id,  # Foreign class
            'student': self.user.id
        }
        res_enroll = self.client.post(enroll_url, post_enroll_data, format='json', HTTP_X_ORGANIZATION_SLUG='crm-org')
        self.assertEqual(res_enroll.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('academy_class', res_enroll.data)
