from unittest import mock
from django.test import TransactionTestCase
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test.utils import CaptureQueriesContext
from django.db import connection
from accounts.models import Organization, Role, Permission, OrgMember
from accounts.permissions import has_org_permission, resolve_organization

User = get_user_model()


class PermissionsCacheTest(TransactionTestCase):
    def setUp(self):
        # Clear cache before each test
        cache.clear()
        
        # Create user, org, and permissions
        self.user = User.objects.create_user(username='test_member', password='password')
        self.org = Organization.objects.create(name='Acme Academy', slug='acme-academy', owner=self.user)
        
        self.perm1 = Permission.objects.create(codename='can_edit_stuff', name='Can Edit Stuff')
        self.perm2 = Permission.objects.create(codename='can_delete_stuff', name='Can Delete Stuff')
        
        self.role = Role.objects.create(name='Teacher')
        self.role.permissions.add(self.perm1)
        
        self.member = OrgMember.objects.create(
            organization=self.org,
            user=self.user,
            role=self.role
        )

    def test_cache_miss_queries_db_and_populates_cache(self):
        # First check should be a cache miss, so it queries the DB
        with CaptureQueriesContext(connection) as ctx:
            has_perm = has_org_permission(self.user, self.org, 'can_edit_stuff')
            self.assertTrue(has_perm)
            initial_queries = len(ctx.captured_queries)
            self.assertGreater(initial_queries, 0)
            
        # Verify the key is stored in cache
        cache_key = f"user_org_perms:{self.user.id}:{self.org.id}"
        cached_perms = cache.get(cache_key)
        self.assertIsNotNone(cached_perms)
        self.assertIn('can_edit_stuff', cached_perms)

        # Clear the Tier 1 request-scoped cache by creating/using a fresh user instance
        fresh_user = User.objects.get(id=self.user.id)
        
        # Second check with fresh user should hit Tier 2 (Redis/LocMemCache) and NOT query DB
        with CaptureQueriesContext(connection) as ctx:
            has_perm = has_org_permission(fresh_user, self.org, 'can_edit_stuff')
            self.assertTrue(has_perm)
            # The count should be 0 because it's resolved entirely from cache
            self.assertEqual(len(ctx.captured_queries), 0)

    def test_tier1_request_scope_cache(self):
        # Prime the cache and populate both tiers
        has_org_permission(self.user, self.org, 'can_edit_stuff')
        
        # Mock cache.get to verify Tier 2 is NOT hit when Tier 1 request-scope cache is present
        with mock.patch('django.core.cache.cache.get') as mock_cache_get:
            # Check permission again with the same user instance
            has_perm = has_org_permission(self.user, self.org, 'can_edit_stuff')
            self.assertTrue(has_perm)
            # mock_cache_get.assert_not_called() means Tier 1 was hit
            mock_cache_get.assert_not_called()

    def test_signal_member_save_invalidates_cache(self):
        # Populate cache
        has_org_permission(self.user, self.org, 'can_edit_stuff')
        cache_key = f"user_org_perms:{self.user.id}:{self.org.id}"
        self.assertIsNotNone(cache.get(cache_key))
        
        # Update member (e.g. change role)
        new_role = Role.objects.create(name='Assistant')
        self.member.role = new_role
        self.member.save()
        
        # Cache key should be invalidated/deleted
        self.assertIsNone(cache.get(cache_key))

    def test_signal_member_delete_invalidates_cache(self):
        # Populate cache
        has_org_permission(self.user, self.org, 'can_edit_stuff')
        cache_key = f"user_org_perms:{self.user.id}:{self.org.id}"
        self.assertIsNotNone(cache.get(cache_key))
        
        # Delete member
        self.member.delete()
        
        # Cache key should be invalidated/deleted
        self.assertIsNone(cache.get(cache_key))

    def test_signal_role_save_invalidates_cache(self):
        # Populate cache
        has_org_permission(self.user, self.org, 'can_edit_stuff')
        cache_key = f"user_org_perms:{self.user.id}:{self.org.id}"
        self.assertIsNotNone(cache.get(cache_key))
        
        # Update Role description
        self.role.description = 'Updated Description'
        self.role.save()
        
        # Cache key should be invalidated/deleted
        self.assertIsNone(cache.get(cache_key))

    def test_signal_role_delete_invalidates_cache(self):
        # Populate cache
        has_org_permission(self.user, self.org, 'can_edit_stuff')
        cache_key = f"user_org_perms:{self.user.id}:{self.org.id}"
        self.assertIsNotNone(cache.get(cache_key))
        
        # Delete Role
        self.role.delete()
        
        # Cache key should be invalidated/deleted
        self.assertIsNone(cache.get(cache_key))

    def test_signal_role_m2m_changed_invalidates_cache(self):
        # Populate cache
        has_org_permission(self.user, self.org, 'can_edit_stuff')
        cache_key = f"user_org_perms:{self.user.id}:{self.org.id}"
        self.assertIsNotNone(cache.get(cache_key))
        
        # Add a new permission to Role
        self.role.permissions.add(self.perm2)
        
        # Cache key should be invalidated/deleted
        self.assertIsNone(cache.get(cache_key))
        
        # Clear the Tier 1 request-scoped cache by using a fresh user instance
        fresh_user = User.objects.get(id=self.user.id)
        
        # Repopulate cache
        has_org_permission(fresh_user, self.org, 'can_delete_stuff')
        self.assertIsNotNone(cache.get(cache_key))
        
        # Remove permission
        self.role.permissions.remove(self.perm2)
        self.assertIsNone(cache.get(cache_key))

    def test_no_fallback_to_default_academy(self):
        class DummyRequest:
            headers = {}
            query_params = {}
            GET = {}

        # Resolve organization with empty request should return None (no fallback)
        org = resolve_organization(DummyRequest(), view_kwargs={})
        self.assertIsNone(org)
