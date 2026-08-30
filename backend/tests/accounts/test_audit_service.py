from django.test import TransactionTestCase
from django.contrib.auth import get_user_model
from accounts.models import Organization, AuditLog
from accounts.services.audit_service import AuditService

User = get_user_model()

class AuditServiceTest(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        self.org = Organization.objects.create(name='Test Org', slug='test-org', owner=self.user)

    def test_log_creates_audit_entry(self):
        class DummyEntity:
            pass
            
        entity = DummyEntity()
        entity.id = 42
        
        before = {"status": "pending"}
        after = {"status": "approved"}
        
        AuditService.log(
            actor=self.user,
            action='dummy.action',
            entity=entity,
            before=before,
            after=after,
            organization=self.org
        )
        
        log = AuditLog.objects.first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor, self.user)
        self.assertEqual(log.organization, self.org)
        self.assertEqual(log.action, 'dummy.action')
        self.assertEqual(log.entity_type, 'DummyEntity')
        self.assertEqual(log.entity_id, 42)
        self.assertEqual(log.before_state, before)
        self.assertEqual(log.after_state, after)

    def test_log_system_action(self):
        class DummyEntity:
            pass
            
        entity = DummyEntity()
        entity.id = 99
        
        AuditService.log(
            actor=None,
            action='system.action',
            entity=entity,
            organization=self.org
        )
        
        log = AuditLog.objects.first()
        self.assertIsNotNone(log)
        self.assertIsNone(log.actor)
        self.assertEqual(log.action, 'system.action')

    def test_audit_log_created(self):
        # Already covered by test_log_creates_audit_entry, alias provided for completeness
        self.test_log_creates_audit_entry()

    def test_before_after_state_saved(self):
        # Covered by test_log_creates_audit_entry, alias provided
        self.test_log_creates_audit_entry()
        
    def test_null_actor_allowed(self):
        # Covered by test_log_system_action, alias provided
        self.test_log_system_action()

    def test_ip_and_user_agent_saved(self):
        class DummyRequest:
            META = {
                'REMOTE_ADDR': '192.168.1.1',
                'HTTP_USER_AGENT': 'Mozilla/5.0 TestBrowser'
            }
            
        class DummyEntity:
            pass
            
        entity = DummyEntity()
        entity.id = 101

        AuditService.log(
            actor=self.user,
            action='ip.action',
            entity=entity,
            organization=self.org,
            request=DummyRequest()
        )
        
        log = AuditLog.objects.first()
        self.assertIsNotNone(log)
        self.assertEqual(log.ip_address, '192.168.1.1')
        self.assertEqual(log.user_agent, 'Mozilla/5.0 TestBrowser')

    def test_audit_service_creates_record(self):
        # Meta-test: ensuring service doesn't crash on empty/minimal inputs
        class DummyEntity:
            pass
        entity = DummyEntity()
        entity.id = 1
        AuditService.log(actor=None, action='minimal', entity=entity)
        self.assertTrue(AuditLog.objects.filter(action='minimal').exists())

    def test_audit_logs_api_admin_access(self):
        from rest_framework.test import APIClient
        from rest_framework import status
        from accounts.models import Role, OrgMember, Permission
        
        # Setup admin client
        client = APIClient()
        admin_user = User.objects.create_user(username='admin_user', password='password')
        
        # Add admin permission
        manage_perm, _ = Permission.objects.get_or_create(codename='can_manage_members', defaults={'name': 'Manage Members'})
        admin_role = Role.objects.create(name='Admin', organization=self.org)
        admin_role.permissions.add(manage_perm)
        OrgMember.objects.create(organization=self.org, user=admin_user, role=admin_role)
        
        # Log some dummy actions
        class DummyEntity:
            id = 1
        entity = DummyEntity()
        AuditService.log(actor=admin_user, action='test.create', entity=entity, organization=self.org)
        AuditService.log(actor=admin_user, action='test.update', entity=entity, organization=self.org)
        
        client.force_authenticate(user=admin_user)
        # Pass org slug header
        response = client.get('/api/auth/audit-logs/', HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # The list has 3 logs because setup and other tests run on same DB instance, but we can verify our new log is in the results
        self.assertTrue(any(item['action'] == 'test.create' for item in response.data['results']))
        
    def test_audit_logs_api_non_admin_denied(self):
        from rest_framework.test import APIClient
        from rest_framework import status
        from accounts.models import Role, OrgMember
        
        client = APIClient()
        teacher_user = User.objects.create_user(username='teacher_user', password='password')
        teacher_role = Role.objects.create(name='Teacher', organization=self.org)
        OrgMember.objects.create(organization=self.org, user=teacher_user, role=teacher_role)
        
        client.force_authenticate(user=teacher_user)
        response = client.get('/api/auth/audit-logs/', HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_audit_logs_api_filters_and_meta(self):
        from rest_framework.test import APIClient
        from rest_framework import status
        from accounts.models import Role, OrgMember, Permission
        
        client = APIClient()
        admin_user = User.objects.create_user(username='admin_user_2', password='password')
        manage_perm, _ = Permission.objects.get_or_create(codename='can_manage_members', defaults={'name': 'Manage Members'})
        admin_role = Role.objects.create(name='Admin2', organization=self.org)
        admin_role.permissions.add(manage_perm)
        OrgMember.objects.create(organization=self.org, user=admin_user, role=admin_role)
        
        class DummyEntity:
            id = 5
        entity = DummyEntity()
        AuditService.log(actor=admin_user, action='member.invite', entity=entity, organization=self.org)
        
        client.force_authenticate(user=admin_user)
        # Test filters
        response = client.get('/api/auth/audit-logs/?action=member.invite', HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['action'], 'member.invite')
        
        # Test metadata filters endpoint
        meta_response = client.get('/api/auth/audit-logs/?get_filters=true', HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(meta_response.status_code, status.HTTP_200_OK)
        self.assertIn('member.invite', meta_response.data['actions'])

    def test_audit_log_secret_scrubbing(self):
        class DummyEntity:
            id = 1
        entity = DummyEntity()
        before = {
            "username": "user",
            "password": "mysecretpassword123",
            "metadata": {
                "access_token": "secret_token_abc",
                "non_sensitive": "public_data"
            },
            "list_data": [
                {"api_key": "api_key_value"},
                "plain_string"
            ]
        }
        after = {
            "password_hash": "pbkdf2_sha256$260000$...",
            "metadata": {
                "access_token": "[UPDATED]",
                "non_sensitive": "public_data"
            }
        }
        AuditService.log(
            actor=self.user,
            action='user.update',
            entity=entity,
            before=before,
            after=after,
            organization=self.org
        )
        
        log = AuditLog.objects.filter(action='user.update').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.before_state["password"], "[REDACTED]")
        self.assertEqual(log.before_state["metadata"]["access_token"], "[REDACTED]")
        self.assertEqual(log.before_state["metadata"]["non_sensitive"], "public_data")
        self.assertEqual(log.before_state["list_data"][0]["api_key"], "[REDACTED]")
        self.assertEqual(log.before_state["list_data"][1], "plain_string")
        self.assertEqual(log.after_state["password_hash"], "[REDACTED]")


