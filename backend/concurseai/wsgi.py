"""WSGI config para ConcurseAI."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "concurseai.settings.dev")

application = get_wsgi_application()
