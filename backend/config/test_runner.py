from django.test.runner import DiscoverRunner
from django.test import SimpleTestCase
from django.core.cache import cache

class CacheClearingDiscoverRunner(DiscoverRunner):
    """
    Custom Django test runner that ensures cache isolation between test cases.
    Monkeypatches SimpleTestCase._pre_setup to invoke `cache.clear()`
    before every single test runs.
    """
    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        
        # Monkeypatch SimpleTestCase._pre_setup classmethod
        original_pre_setup = SimpleTestCase._pre_setup
        
        @classmethod
        def new_pre_setup(cls, *args, **kwargs_inner):
            cache.clear()
            return original_pre_setup.__func__(cls, *args, **kwargs_inner)
            
        SimpleTestCase._pre_setup = new_pre_setup
