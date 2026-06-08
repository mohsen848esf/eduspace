from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import Organization, Course, OrgMember, Role, Permission

User = get_user_model()


class OrgResolutionIntegrationTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test_user', password='password')
        self.org1 = Organization.objects.create(name='Org One', slug='org-one')
        self.org2 = Organization.objects.create(name='Org Two', slug='org-two')
        
        # Create or fetch a teacher role with can_view_dashboard permission
        self.perm, _ = Permission.objects.get_or_create(codename='can_view_dashboard', defaults={'name': 'View Dashboard'})
        self.role, _ = Role.objects.get_or_create(name='Teacher')
        self.role.permissions.add(self.perm)
        
        # Enroll user in org1 only
        self.member1 = OrgMember.objects.create(
            organization=self.org1,
            user=self.user,
            role=self.role
        )
        
        # Create courses in both orgs
        self.course1 = Course.objects.create(
            title='Course in Org 1',
            code='CS101',
            organization=self.org1
        )
        self.course2 = Course.objects.create(
            title='Course in Org 2',
            code='CS102',
            organization=self.org2
        )
        
        self.client.force_authenticate(user=self.user)

    def test_missing_org_header_returns_400(self):
        # Accessing courses list endpoint without X-Organization-Slug header
        url = reverse('course-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(
            response.data['error'],
            'Organization context required. Include X-Organization-Slug header.'
        )

    def test_valid_org_header_filters_queryset(self):
        url = reverse('course-list')
        
        # Access with org-one header
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='org-one')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should only see course in org1
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Course in Org 1')

    def test_query_parameter_resolution(self):
        url = reverse('course-list')
        
        # Access with query param ?org_slug=org-one
        response = self.client.get(f"{url}?org_slug=org-one")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Course in Org 1')

    def test_unauthorized_org_access_returns_403(self):
        url = reverse('course-list')
        
        # Access with org-two header where user is not a member
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG='org-two')
        
        # User is not a member of org-two, so they should get 403 Forbidden
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_resolve_organization_by_id(self):
        url = reverse('course-list')
        
        # Access with query param ?org_slug containing org id
        response = self.client.get(f"{url}?org_slug={self.org1.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_resolve_organization_by_invalid_id(self):
        url = reverse('course-list')
        
        # Access with invalid integer org id
        response = self.client.get(f"{url}?org_slug=99999")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_require_org_permission_decorator(self):
        from rest_framework.decorators import api_view, permission_classes
        from rest_framework.permissions import IsAuthenticated
        from rest_framework.response import Response
        from accounts.permissions import require_org_permission
        
        @api_view(['GET'])
        @permission_classes([IsAuthenticated])
        @require_org_permission('can_view_dashboard')
        def dummy_view(request):
            return Response({'status': 'ok'})
            
        from rest_framework.test import APIRequestFactory, force_authenticate
        factory = APIRequestFactory()
        
        # 1. Missing context -> HTTP 400
        request = factory.get('/dummy/')
        force_authenticate(request, user=self.user)
        response = dummy_view(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # 2. Valid context and authorized -> HTTP 200
        request = factory.get('/dummy/', HTTP_X_ORGANIZATION_SLUG='org-one')
        force_authenticate(request, user=self.user)
        response = dummy_view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 3. Valid context but unauthorized -> HTTP 403
        request = factory.get('/dummy/', HTTP_X_ORGANIZATION_SLUG='org-two')
        force_authenticate(request, user=self.user)
        response = dummy_view(request)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_resolve_organization_by_room_code(self):
        from rooms.models import Room
        from accounts.models import AcademyClass
        from accounts.permissions import resolve_organization
        
        room = Room.objects.create(room_code='ROOM99', host=self.user)
        academy_class = AcademyClass.objects.create(
            course=self.course1,
            room=room,
            name='Test Class'
        )
        
        org = resolve_organization(None, view_kwargs={'room_code': 'ROOM99'})
        self.assertEqual(org, self.org1)

    def test_resolve_organization_by_recording_token(self):
        from rooms.models import Room, Recording
        from accounts.models import AcademyClass
        from accounts.permissions import resolve_organization
        
        room = Room.objects.create(room_code='ROOM88', host=self.user)
        academy_class = AcademyClass.objects.create(
            course=self.course1,
            room=room,
            name='Test Class'
        )
        recording = Recording.objects.create(
            room=room,
            owner=self.user,
            public_token='TOKEN_ABC'
        )
        
        org = resolve_organization(None, view_kwargs={'token': 'TOKEN_ABC'})
        self.assertEqual(org, self.org1)
