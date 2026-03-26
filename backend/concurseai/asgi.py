"""
ASGI config para ConcurseAI.
Necessário para views async (llm/views.py).
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "concurseai.settings.dev")

application = get_asgi_application()
