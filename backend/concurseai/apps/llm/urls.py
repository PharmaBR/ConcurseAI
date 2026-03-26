from django.urls import path

from .views import gerar_trilha_view

urlpatterns = [
    path("trilha/<uuid:concurso_id>/", gerar_trilha_view, name="llm-gerar-trilha"),
    # TODO FASE 2: path("explicar/", explicar_stream_view, name="llm-explicar"),
]
