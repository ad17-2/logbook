from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class GeocodingError(APIException):
    status_code = 502
    default_detail = 'Geocoding service failed.'
    default_code = 'geocoding_error'


class RoutingError(APIException):
    status_code = 502
    default_detail = 'Routing service failed.'
    default_code = 'routing_error'


class LocationNotFound(APIException):
    status_code = 400
    default_detail = 'Address could not be found.'
    default_code = 'location_not_found'


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return None

    errors = []

    if isinstance(response.data, dict):
        for field, messages in response.data.items():
            if isinstance(messages, list):
                for msg in messages:
                    errors.append({'field': field, 'message': str(msg)})
            else:
                errors.append({'field': field, 'message': str(messages)})
    elif isinstance(response.data, list):
        for msg in response.data:
            errors.append({'field': 'non_field_errors', 'message': str(msg)})

    response.data = {
        'errors': errors,
        'status_code': response.status_code,
    }

    return response
