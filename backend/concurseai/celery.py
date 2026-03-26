"""Configuração do Celery para ConcurseAI."""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "concurseai.settings.dev")

app = Celery("concurseai")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
