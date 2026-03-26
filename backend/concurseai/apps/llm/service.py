"""
Lógica de negócio para chamadas LLM.
Views não chamam client.py diretamente — passam por aqui.
"""
import json
import logging

from . import client, prompts

logger = logging.getLogger(__name__)


class LLMServiceError(Exception):
    """Erro genérico do serviço LLM."""
    pass


class SemCreditoError(LLMServiceError):
    """Usuário sem créditos para usar a LLM."""
    pass


async def gerar_trilha_para_concurso(concurso) -> dict:
    """
    Gera a estrutura de trilha para um concurso via LLM.

    1. Verifica se o concurso tem texto do edital.
    2. Chama client.complete() com os prompts adequados.
    3. Faz parse do JSON retornado.
    4. Retorna dict — NÃO salva no banco (responsabilidade da view).

    Raises:
        LLMServiceError: se edital vazio, resposta inválida ou erro de parse.
    """
    if not concurso.edital_texto or not concurso.edital_texto.strip():
        raise LLMServiceError(
            f"Concurso '{concurso}' não possui texto de edital. "
            "Adicione o conteúdo do edital no painel admin antes de gerar a trilha."
        )

    banca_nome = concurso.banca.nome if concurso.banca else ""
    system_prompt = prompts.system_gerar_trilha()
    user_message = prompts.user_gerar_trilha(concurso.edital_texto, concurso.cargo, banca=banca_nome)

    try:
        raw_response = await client.complete(system_prompt, user_message)
    except Exception as exc:
        logger.exception("Erro na chamada LLM para concurso %s", concurso.id)
        raise LLMServiceError(f"Falha na comunicação com a LLM: {exc}") from exc

    try:
        data = json.loads(raw_response)
    except json.JSONDecodeError as exc:
        logger.error("JSON inválido retornado pela LLM: %s", raw_response[:200])
        raise LLMServiceError("A LLM retornou uma resposta em formato inválido.") from exc

    if "modulos" not in data or not isinstance(data["modulos"], list):
        raise LLMServiceError("Resposta da LLM não contém o campo 'modulos' esperado.")

    return data


# TODO FASE 2: stream_explicacao(usuario, pergunta, disciplina) -> AsyncIterator[str]
#   - verifica usuario.tem_credito_llm → SemCreditoError
#   - debita com aupdate (F expression, async-safe)
#   - chama client.stream_chat e faz yield dos tokens
#
# async def stream_explicacao(usuario, pergunta: str, disciplina: str):
#     if not usuario.tem_credito_llm:
#         raise SemCreditoError("Você não possui créditos para usar esta funcionalidade.")
#     from django.db.models import F
#     from concurseai.apps.users.models import User
#     if usuario.plano == User.Plano.GRATUITO:
#         await User.objects.filter(pk=usuario.pk).aupdate(creditos_llm=F("creditos_llm") - 1)
#     system_prompt = prompts.system_explicar_conteudo(disciplina)
#     async for token in client.stream_chat(system_prompt, pergunta):
#         yield token
