"""
Views do app LLM.
MVP: apenas geração de trilha.
Chat streaming é Fase 2.

Nota: @api_view do DRF 3.15 não suporta `async def` diretamente.
A view é síncrona e usa async_to_sync para chamar o service assíncrono.
O service.py permanece async para ser testável com pytest-asyncio.
"""
import logging

from asgiref.sync import async_to_sync
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from concurseai.apps.concursos.models import Concurso
from concurseai.apps.trilhas.models import Modulo, Trilha

from .service import LLMServiceError, SemCreditoError, gerar_trilha_para_concurso

logger = logging.getLogger(__name__)


# MVP
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gerar_trilha_view(request, concurso_id):
    """
    POST /api/llm/trilha/<uuid>/
    Gera a trilha de estudos para um concurso via LLM e persiste no banco.
    """
    try:
        concurso = Concurso.objects.select_related("banca").get(id=concurso_id)
    except Concurso.DoesNotExist:
        return Response({"detail": "Concurso não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    # Verifica se já existe trilha para este usuário/concurso
    trilha_existente = Trilha.objects.filter(
        usuario=request.user, concurso=concurso
    ).first()
    if trilha_existente:
        return Response(
            {"detail": "Trilha já existe.", "trilha_id": str(trilha_existente.id)},
            status=status.HTTP_200_OK,
        )

    try:
        data = async_to_sync(gerar_trilha_para_concurso)(concurso)
    except SemCreditoError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_402_PAYMENT_REQUIRED)
    except LLMServiceError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    # Persiste trilha e módulos
    trilha = Trilha.objects.create(usuario=request.user, concurso=concurso)
    modulos_criados = []
    for mod_data in data.get("modulos", []):
        modulo = Modulo.objects.create(
            trilha=trilha,
            nome=mod_data.get("nome", ""),
            ordem=mod_data.get("ordem", 0),
            peso=mod_data.get("peso", 0.0),
            topicos=mod_data.get("topicos", []),
        )
        modulos_criados.append({
            "id": modulo.id,
            "nome": modulo.nome,
            "ordem": modulo.ordem,
            "peso": modulo.peso,
            "status": modulo.status,
            "progresso": modulo.progresso,
            "topicos": modulo.topicos,
        })

    return Response(
        {"trilha_id": str(trilha.id), "modulos": modulos_criados},
        status=status.HTTP_201_CREATED,
    )


# TODO FASE 2: explicar_stream_view
# POST /api/llm/explicar/
# StreamingHttpResponse com content_type="text/event-stream"
# Formato SSE: event: message\ndata: {"token": "..."}\n\n
# Evento fim: event: fim\ndata: {"fim": true}\n\n
# Erros: event: erro\ndata: {"erro": "mensagem"}\n\n
# Header X-Accel-Buffering: no (desativa buffer nginx)
#
# async def explicar_stream_view(request):
#     if request.method != "POST":
#         return JsonResponse({"detail": "Método não permitido."}, status=405)
#     ...
#     async def event_stream():
#         try:
#             async for token in service.stream_explicacao(request.user, pergunta, disciplina):
#                 yield f"event: message\ndata: {json.dumps({'token': token})}\n\n"
#             yield f"event: fim\ndata: {json.dumps({'fim': True})}\n\n"
#         except SemCreditoError as exc:
#             yield f"event: erro\ndata: {json.dumps({'erro': str(exc)})}\n\n"
#     response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
#     response["X-Accel-Buffering"] = "no"
#     return response
