from django.urls import path

from .views import explicar_stream_view, gerar_trilha_view

urlpatterns = [
    path("trilha/<uuid:concurso_id>/", gerar_trilha_view, name="llm-gerar-trilha"),
    path("explicar/", explicar_stream_view, name="llm-explicar"),
]
