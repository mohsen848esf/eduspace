from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle
from accounts.permissions import resolve_organization

class TenantUserRateThrottle(UserRateThrottle):
    def allow_request(self, request, view):
        try:
            org = resolve_organization(request)
            if org and hasattr(org, 'custom_user_throttle_rate') and org.custom_user_throttle_rate:
                self.rate = org.custom_user_throttle_rate
            else:
                self.rate = self.get_rate()
        except Exception:
            self.rate = self.get_rate()
            
        self.num_requests, self.duration = self.parse_rate(self.rate)
        return super().allow_request(request, view)

class TenantScopedRateThrottle(ScopedRateThrottle):
    def allow_request(self, request, view):
        self.scope = getattr(view, self.scope_attr, None)
        if not self.scope:
            resolver_match = getattr(request, 'resolver_match', None)
            if resolver_match and hasattr(resolver_match, 'func'):
                self.scope = getattr(resolver_match.func, self.scope_attr, None)
                
        if not self.scope:
            return True
            
        try:
            org = resolve_organization(request)
            if org and hasattr(org, f'custom_{self.scope}_throttle_rate'):
                val = getattr(org, f'custom_{self.scope}_throttle_rate')
                if val:
                    self.rate = val
                else:
                    self.rate = self.get_rate()
            else:
                self.rate = self.get_rate()
        except Exception:
            self.rate = self.get_rate()
            
        self.num_requests, self.duration = self.parse_rate(self.rate)
        from rest_framework.throttling import SimpleRateThrottle
        return SimpleRateThrottle.allow_request(self, request, view)




