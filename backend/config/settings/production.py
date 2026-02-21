from .base import *  # noqa: F401,F403

DEBUG = False

ALLOWED_HOSTS = env('ALLOWED_HOSTS')  # noqa: F405

CORS_ALLOWED_ORIGINS = env('CORS_ALLOWED_ORIGINS')  # noqa: F405

SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=False)  # noqa: F405
SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', default=0)  # noqa: F405
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

LOGGING['loggers']['trips']['level'] = 'INFO'  # noqa: F405
