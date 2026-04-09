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
from concurseai.apps.trilhas.models import Flashcard, LacunaConceitual, Modulo, Proficiencia, QuizGerado, QuizTentativa, Trilha
from concurseai.apps.users.models import User

from .service import (
    LLMServiceError,
    SemCreditoError,
    analisar_lacunas_e_gerar_flashcards,
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
    Body (opcional): {
      "tipo": "subtopico"|"topico"|"modulo",   (default: "modulo")
      "referencia": "<nome do subtópico ou tópico>",  (obrigatório para subtopico/topico)
      "topico_nome": "<nome do tópico pai>",   (obrigatório quando tipo=subtopico)
      "regenerar": true                        (força nova geração mesmo se já existe)
    }

    Retorna ou gera quiz de 5 questões no nível solicitado.
    Cache: retorna o quiz existente (tipo+referencia) sem chamar a LLM, a menos que
    'regenerar': true seja enviado.
    """
    try:
        modulo = Modulo.objects.select_related(
            "trilha__usuario", "trilha__concurso__banca"
        ).get(id=modulo_id, trilha__usuario=request.user)
    except Modulo.DoesNotExist:
        return Response({"detail": "Módulo não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    body = {}
    if request.body:
        try:
            body = json.loads(request.body)
        except (json.JSONDecodeError, AttributeError):
            pass

    tipo = body.get("tipo", "modulo")
    referencia = body.get("referencia", "").strip()
    topico_nome = body.get("topico_nome", "").strip()
    regenerar = body.get("regenerar", False)

    if tipo not in ("subtopico", "topico", "modulo"):
        return Response({"detail": "Tipo inválido. Use 'subtopico', 'topico' ou 'modulo'."}, status=status.HTTP_400_BAD_REQUEST)

    # Cache: retorna quiz existente salvo para este (modulo, tipo, referencia)
    if not regenerar:
        quiz_existente = QuizGerado.objects.filter(modulo=modulo, tipo=tipo, referencia=referencia).first()
        if quiz_existente:
            return Response({"questoes": quiz_existente.questoes}, status=status.HTTP_200_OK)

    banca = modulo.trilha.concurso.banca.nome if modulo.trilha.concurso.banca else ""

    try:
        data = async_to_sync(gerar_quiz_para_modulo)(
            modulo, banca=banca, tipo=tipo, referencia=referencia, topico_nome=topico_nome
        )
    except LLMServiceError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    quiz, created = QuizGerado.objects.update_or_create(
        modulo=modulo,
        tipo=tipo,
        referencia=referencia,
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
    Body: {
      "respostas": {"0": "A", "1": "C", ...},
      "tipo": "subtopico"|"topico"|"modulo",   (default: "modulo")
      "referencia": "<nome do subtópico ou tópico>"
    }

    Calcula acertos, persiste a tentativa e atualiza Proficiencia no nível correspondente.
    Retorna acertos, total, estrelas e o score de proficiência atualizado.
    """
    try:
        modulo = Modulo.objects.select_related("trilha__usuario").get(
            id=modulo_id, trilha__usuario=request.user
        )
    except Modulo.DoesNotExist:
        return Response({"detail": "Módulo não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    tipo = request.data.get("tipo", "modulo")
    referencia = request.data.get("referencia", "").strip() if request.data.get("referencia") else ""

    try:
        quiz = QuizGerado.objects.get(modulo=modulo, tipo=tipo, referencia=referencia)
    except QuizGerado.DoesNotExist:
        return Response({"detail": "Quiz não encontrado para este nível."}, status=status.HTTP_404_NOT_FOUND)

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

    # Atualiza Proficiencia — mantém apenas o melhor score histórico
    prof, prof_created = Proficiencia.objects.get_or_create(
        modulo=modulo,
        usuario=request.user,
        nivel=tipo,
        referencia=referencia,
        defaults={"melhor_acertos": acertos, "total_questoes": total, "total_tentativas": 1},
    )
    if not prof_created:
        prof.total_tentativas += 1
        if acertos > prof.melhor_acertos:
            prof.melhor_acertos = acertos
            prof.total_questoes = total
        prof.save(update_fields=["melhor_acertos", "total_questoes", "total_tentativas", "atualizado_em"])

    return Response(
        {
            "acertos": acertos,
            "total": total,
            "estrelas": tentativa.estrelas,
            "tentativa_id": tentativa.id,
            "melhor_score": prof.melhor_score,
            "dominado": prof.dominado,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def gerar_lacunas_view(request, modulo_id):
    """
    POST /api/llm/quiz/<modulo_id>/lacunas/
    Body: {"tentativa_id": int}

    Analisa as questões erradas da tentativa via LLM, cria LacunaConceitual e
    Flashcard para cada erro. Idempotente: não duplica lacunas já existentes.
    """
    tentativa_id = request.data.get("tentativa_id")
    if not tentativa_id:
        return Response({"detail": "O campo 'tentativa_id' é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        modulo = Modulo.objects.select_related("trilha__usuario").get(
            id=modulo_id, trilha__usuario=request.user
        )
        tentativa = QuizTentativa.objects.select_related("quiz__modulo").get(
            id=tentativa_id, usuario=request.user, quiz__modulo=modulo
        )
    except (Modulo.DoesNotExist, QuizTentativa.DoesNotExist):
        return Response({"detail": "Tentativa não encontrada."}, status=status.HTTP_404_NOT_FOUND)

    try:
        data = async_to_sync(analisar_lacunas_e_gerar_flashcards)(tentativa, modulo.nome)
    except LLMServiceError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    lacunas_resultado = []
    for item in data.get("lacunas", []):
        lacuna, _ = LacunaConceitual.objects.get_or_create(
            tentativa=tentativa,
            numero_questao=item.get("numero_questao", 0),
            defaults={
                "usuario": request.user,
                "subtopico_ref": item.get("subtopico_ref", ""),
                "conceito": item.get("conceito", ""),
            },
        )
        flashcard, _ = Flashcard.objects.get_or_create(
            lacuna=lacuna,
            defaults={
                "frente": item.get("flashcard_frente", ""),
                "verso": item.get("flashcard_verso", ""),
            },
        )
        lacunas_resultado.append({
            "id": lacuna.id,
            "numero_questao": lacuna.numero_questao,
            "subtopico_ref": lacuna.subtopico_ref,
            "conceito": lacuna.conceito,
            "flashcard": {
                "id": flashcard.id,
                "frente": flashcard.frente,
                "verso": flashcard.verso,
                "dominado": flashcard.dominado,
                "acertos_consecutivos": flashcard.acertos_consecutivos,
                "acertos_para_dominio": Flashcard.ACERTOS_PARA_DOMINIO,
            },
        })

    return Response({"lacunas": lacunas_resultado}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_lacunas_view(request, modulo_id):
    """
    GET /api/llm/quiz/<modulo_id>/lacunas/
    Retorna todas as lacunas (com flashcards) do usuário neste módulo,
    agrupadas por subtopico_ref. Útil para exibir o deck completo no ModuloCard.
    """
    try:
        modulo = Modulo.objects.get(id=modulo_id, trilha__usuario=request.user)
    except Modulo.DoesNotExist:
        return Response({"detail": "Módulo não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    lacunas = (
        LacunaConceitual.objects
        .filter(usuario=request.user, tentativa__quiz__modulo=modulo)
        .select_related("flashcard")
        .order_by("subtopico_ref", "conceito")
    )

    resultado = []
    for lacuna in lacunas:
        try:
            fc = lacuna.flashcard
            flashcard_data = {
                "id": fc.id,
                "frente": fc.frente,
                "verso": fc.verso,
                "dominado": fc.dominado,
                "acertos_consecutivos": fc.acertos_consecutivos,
                "acertos_para_dominio": Flashcard.ACERTOS_PARA_DOMINIO,
            }
        except Flashcard.DoesNotExist:
            flashcard_data = None

        resultado.append({
            "id": lacuna.id,
            "numero_questao": lacuna.numero_questao,
            "subtopico_ref": lacuna.subtopico_ref,
            "conceito": lacuna.conceito,
            "flashcard": flashcard_data,
        })

    return Response({"lacunas": resultado})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def responder_flashcard_view(request, flashcard_id):
    """
    POST /api/llm/flashcards/<flashcard_id>/responder/
    Body: {"acertou": true|false}

    Atualiza acertos_consecutivos. Acertar incrementa; errar reseta para 0.
    Quando acertos_consecutivos >= ACERTOS_PARA_DOMINIO, o flashcard é considerado dominado.
    """
    from django.utils import timezone as tz

    try:
        flashcard = Flashcard.objects.select_related("lacuna").get(
            id=flashcard_id, lacuna__usuario=request.user
        )
    except Flashcard.DoesNotExist:
        return Response({"detail": "Flashcard não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    acertou = bool(request.data.get("acertou", False))
    if acertou:
        flashcard.acertos_consecutivos += 1
    else:
        flashcard.acertos_consecutivos = 0

    flashcard.ultima_resposta_em = tz.now()
    flashcard.save(update_fields=["acertos_consecutivos", "ultima_resposta_em"])

    return Response({
        "acertos_consecutivos": flashcard.acertos_consecutivos,
        "dominado": flashcard.dominado,
        "acertos_para_dominio": Flashcard.ACERTOS_PARA_DOMINIO,
    })
