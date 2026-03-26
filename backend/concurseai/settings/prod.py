"""Settings para ambiente de produção."""
from .base import *  # noqa: F401, F403

DEBUG = False

CORS_ALLOWED_ORIGINS = env.list(  # noqa: F405
    "CORS_ALLOWED_ORIGINS",
    default=[],
)

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# Defina como True apenas se o Django termina o SSL diretamente.
# Se usar reverse proxy (nginx/Caddy/Traefik) com SSL, mantenha False.
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=False)  # noqa: F405
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
