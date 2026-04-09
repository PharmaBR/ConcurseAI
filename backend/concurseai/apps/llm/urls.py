from django.urls import path

from .views import (
    explicar_stream_view,
    gerar_lacunas_view,
    gerar_quiz_view,
    gerar_trilha_view,
    listar_lacunas_view,
    responder_flashcard_view,
    salvar_tentativa_view,
)

urlpatterns = [
    path("trilha/<uuid:concurso_id>/", gerar_trilha_view, name="llm-gerar-trilha"),
    path("explicar/", explicar_stream_view, name="llm-explicar"),
    path("quiz/<int:modulo_id>/", gerar_quiz_view, name="llm-gerar-quiz"),
    path("quiz/<int:modulo_id>/tentativa/", salvar_tentativa_view, name="llm-salvar-tentativa"),
    path("quiz/<int:modulo_id>/lacunas/", gerar_lacunas_view, name="llm-gerar-lacunas"),
    path("quiz/<int:modulo_id>/lacunas/listar/", listar_lacunas_view, name="llm-listar-lacunas"),
    path("flashcards/<int:flashcard_id>/responder/", responder_flashcard_view, name="llm-responder-flashcard"),
]
