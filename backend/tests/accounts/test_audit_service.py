from django.test import TransactionTestCase
from django.contrib.auth import get_user_model
from accounts.models import Organization, AuditLog
from accounts.services.audit_service import AuditService

User = get_user_model()

class AuditServiceTest(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        self.org = Organization.objects.create(name='Test Org', slug='test-org')

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
