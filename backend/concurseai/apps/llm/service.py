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


async def gerar_quiz_para_modulo(modulo, banca: str = "") -> dict:
    """
    Gera 5 questões de múltipla escolha para um módulo via LLM.

    Retorna dict com {"questoes": [...]} — NÃO persiste (responsabilidade da view).
    Raises LLMServiceError se a resposta for inválida.
    """
    if not modulo.topicos:
        raise LLMServiceError(
            f"Módulo '{modulo.nome}' não possui tópicos para gerar quiz."
        )

    system_prompt = prompts.system_gerar_quiz(modulo.nome, banca=banca)
    user_message = prompts.user_gerar_quiz(modulo.nome, modulo.topicos)

    try:
        raw = await client.complete(system_prompt, user_message)
    except Exception as exc:
        logger.exception("Erro na chamada LLM para quiz do módulo %s", modulo.id)
        raise LLMServiceError(f"Falha na comunicação com a LLM: {exc}") from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("JSON inválido retornado pela LLM (quiz): %s", raw[:200])
        raise LLMServiceError("A LLM retornou uma resposta em formato inválido.") from exc

    if "questoes" not in data or not isinstance(data["questoes"], list):
        raise LLMServiceError("Resposta da LLM não contém o campo 'questoes' esperado.")

    return data


async def stream_explicacao(usuario, pergunta: str, modulo_nome: str, topico_nome: str = ""):
    """
    Gerador assíncrono de tokens para o chat de explicação por módulo.
    Faz yield de cada token recebido da LLM para uso com StreamingHttpResponse (SSE).

    # TODO FASE 2: adicionar verificação e débito de créditos quando o modelo de
    # planos for implementado (usuario.tem_credito_llm, F expression async-safe).
    """
    system_prompt = prompts.system_explicar_conteudo(modulo_nome)
    user_message = prompts.user_explicar_conteudo(pergunta, modulo_nome, topico_nome)

    try:
        async for token in client.stream_chat(system_prompt, user_message):
            yield token
    except Exception as exc:
        logger.exception("Erro no stream LLM para usuário %s", usuario.id)
        raise LLMServiceError(f"Falha na comunicação com a LLM: {exc}") from exc
