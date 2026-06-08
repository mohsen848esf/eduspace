from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import (
    Organization, Course, AcademyClass, Enrollment, TuitionInvoice, ExpenseItem, OrgMember, Role, Permission
)

User = get_user_model()

class CRMViewsIntegrationTest(APITestCase):
    def setUp(self):
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
