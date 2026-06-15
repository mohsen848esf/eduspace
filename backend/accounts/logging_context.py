import contextvars

_request_id = contextvars.ContextVar('request_id', default=None)
_user_id = contextvars.ContextVar('user_id', default=None)
_org_id = contextvars.ContextVar('org_id', default=None)

def get_request_id():
    return _request_id.get()

def get_user_id():
    return _user_id.get()

def get_org_id():
    return _org_id.get()

def set_logging_context(request_id=None, user_id=None, org_id=None):
    _request_id.set(request_id)
    _user_id.set(user_id)
    _org_id.set(org_id)

def clear_logging_context():
    _request_id.set(None)
    _user_id.set(None)
    _org_id.set(None)
