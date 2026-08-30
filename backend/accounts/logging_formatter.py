import json
import logging
from accounts.logging_context import get_request_id, get_user_id, get_org_id

class StructuredJSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            'timestamp': self.formatTime(record, self.datefmt),
            'severity': record.levelname,
            'message': record.getMessage(),
            'logger': record.name,
            'request_id': get_request_id(),
            'user_id': get_user_id(),
            'organization_id': get_org_id(),
        }
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        return json.dumps(log_data)
