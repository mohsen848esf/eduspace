from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError

def custom_exception_handler(exc, context):
    """
    Standardizes validation and other API error responses into a unified structure:
    {
        "detail": "...",
        "error": "...",
        "errors": ...
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        if isinstance(exc, ValidationError):
            errors = response.data
            detail_msg = "Validation failed."
            
            # Extract first error message for the main "detail" field
            if isinstance(errors, dict):
                if 'non_field_errors' in errors and errors['non_field_errors']:
                    detail_msg = errors['non_field_errors'][0]
                elif 'error' in errors:
                    detail_msg = errors['error']
                elif len(errors) == 1:
                    first_key = list(errors.keys())[0]
                    first_val = errors[first_key]
                    if isinstance(first_val, list) and first_val:
                        detail_msg = f"{first_val[0]}"
                    elif isinstance(first_val, str):
                        detail_msg = first_val
            elif isinstance(errors, list) and errors:
                detail_msg = errors[0]
                
            response.data = {
                "detail": str(detail_msg),
                "error": errors.get('error', 'validation_error') if isinstance(errors, dict) else "validation_error",
                "errors": errors
            }
        else:
            detail = "An error occurred."
            if isinstance(response.data, dict):
                detail = response.data.get("detail", "An error occurred.")
            elif isinstance(response.data, list) and response.data:
                detail = response.data[0]
            elif isinstance(response.data, str):
                detail = response.data

            error_code = getattr(exc, 'default_code', 'server_error')
            
            response.data = {
                "detail": str(detail),
                "error": error_code,
                "errors": response.data
            }

    return response
