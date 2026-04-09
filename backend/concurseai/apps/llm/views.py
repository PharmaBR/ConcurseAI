"""
Views do app LLM.
- gerar_trilha_view: sync DRF view (async_to_sync) — MVP
- explicar_stream_view: async Django view com StreamingHttpResponse (SSE) — Fase 2

Nota: @api_view do DRF 3.15 não suporta `async def` diretamente.
A view de trilha permanece síncrona; a de streaming é Django puro.
"""
import json
import logging

from asgiref.sync import async_to_sync
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError

from concurseai.apps.concursos.models import Concurso
from concurseai.apps.trilhas.models import Modulo, QuizGerado, QuizTentativa, Trilha
from concurseai.apps.users.models import User

from .service import (
    LLMServiceError,
    SemCreditoError,
    gerar_quiz_para_modulo,
    gerar_trilha_para_concurso,
    stream_explicacao,
)

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


@csrf_exempt
async def explicar_stream_view(request):
    """
    POST /api/llm/explicar/
    Body: { "pergunta": str, "modulo_nome": str, "topico_nome": str (opcional) }

    Retorna StreamingHttpResponse com SSE (text/event-stream).
    Usa autenticação JWT manual pois @api_view não suporta async def.

    Formato dos eventos:
      event: message\\ndata: {"token": "..."}\\n\\n
      event: fim\\ndata: {"fim": true}\\n\\n
      event: erro\\ndata: {"erro": "mensagem"}\\n\\n
    """
    if request.method != "POST":
        return JsonResponse({"detail": "Método não permitido."}, status=405)

    # Autenticação JWT manual (async-safe: decodifica token + busca usuário via aget)
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JsonResponse({"detail": "Autenticação necessária."}, status=401)

    try:
        token = AccessToken(auth_header.split(" ", 1)[1])
        usuario = await User.objects.aget(id=token["user_id"])
    except (TokenError, User.DoesNotExist, Exception):
        return JsonResponse({"detail": "Token inválido ou expirado."}, status=401)

    # Parse do body
    try:
        body = json.loads(request.body)
        pergunta = body.get("pergunta", "").strip()
        modulo_nome = body.get("modulo_nome", "").strip()
        topico_nome = body.get("topico_nome", "").strip()
    except (json.JSONDecodeError, AttributeError):
        return JsonResponse({"detail": "Corpo da requisição inválido."}, status=400)

    if not pergunta:
        return JsonResponse({"detail": "O campo 'pergunta' é obrigatório."}, status=400)
    if not modulo_nome:
        return JsonResponse({"detail": "O campo 'modulo_nome' é obrigatório."}, status=400)

    async def event_stream():
        try:
            async for token in stream_explicacao(usuario, pergunta, modulo_nome, topico_nome):
                yield f"event: message\ndata: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"
            yield f"event: fim\ndata: {json.dumps({'fim': True})}\n\n"
        except SemCreditoError as exc:
            yield f"event: erro\ndata: {json.dumps({'erro': str(exc)})}\n\n"
        except LLMServiceError as exc:
            yield f"event: erro\ndata: {json.dumps({'erro': str(exc)})}\n\n"

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["X-Accel-Buffering"] = "no"
    response["Cache-Control"] = "no-cache"
    return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gerar_quiz_view(request, modulo_id):
    """
    POST /api/llm/quiz/<modulo_id>/
    Gera (ou retorna existente) quiz de 5 questões para o módulo via LLM.
    Persiste em QuizGerado (OneToOne com Modulo).
    """
    try:
        modulo = Modulo.objects.select_related(
            "trilha__usuario", "trilha__concurso__banca"
        ).get(id=modulo_id, trilha__usuario=request.user)
    except Modulo.DoesNotExist:
        return Response({"detail": "Módulo não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    # Retorna quiz existente sem chamar a LLM novamente
    quiz_existente = QuizGerado.objects.filter(modulo=modulo).first()
    if quiz_existente:
        return Response({"questoes": quiz_existente.questoes}, status=status.HTTP_200_OK)

    banca = modulo.trilha.concurso.banca.nome if modulo.trilha.concurso.banca else ""

    try:
        data = async_to_sync(gerar_quiz_para_modulo)(modulo, banca=banca)
    except LLMServiceError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    quiz, created = QuizGerado.objects.update_or_create(
        modulo=modulo,
        defaults={"questoes": data["questoes"]},
    )
    return Response(
        {"questoes": quiz.questoes},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def salvar_tentativa_view(request, modulo_id):
    """
    POST /api/llm/quiz/<modulo_id>/tentativa/
    Body: {"respostas": {"0": "A", "1": "C", ...}}

    Calcula acertos, persiste a tentativa e retorna acertos + estrelas.
    O melhor score fica disponível via GET /api/trilhas/<id>/ no campo quiz_estrelas.
    """
    try:
        modulo = Modulo.objects.select_related("trilha__usuario").get(
            id=modulo_id, trilha__usuario=request.user
        )
        quiz = QuizGerado.objects.get(modulo=modulo)
    except (Modulo.DoesNotExist, QuizGerado.DoesNotExist):
        return Response({"detail": "Quiz não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    respostas = request.data.get("respostas", {})
    acertos = sum(
        1 for i, questao in enumerate(quiz.questoes)
        if respostas.get(str(i)) == questao.get("gabarito")
    )
    total = len(quiz.questoes)

    tentativa = QuizTentativa.objects.create(
        quiz=quiz,
        usuario=request.user,
        acertos=acertos,
        total=total,
        respostas=respostas,
    )

    return Response(
        {"acertos": acertos, "total": total, "estrelas": tentativa.estrelas},
        status=status.HTTP_201_CREATED,
    )
