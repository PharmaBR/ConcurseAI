from django.urls import path

from .views import explicar_stream_view, gerar_quiz_view, gerar_trilha_view, salvar_tentativa_view

urlpatterns = [
    path("trilha/<uuid:concurso_id>/", gerar_trilha_view, name="llm-gerar-trilha"),
    path("explicar/", explicar_stream_view, name="llm-explicar"),
    path("quiz/<int:modulo_id>/", gerar_quiz_view, name="llm-gerar-quiz"),
    path("quiz/<int:modulo_id>/tentativa/", salvar_tentativa_view, name="llm-salvar-tentativa"),
]
