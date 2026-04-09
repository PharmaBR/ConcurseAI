"""
Ponto único de contato com a OpenAI.
Toda a aplicação passa por aqui.
Se trocar de provider, só este arquivo muda.
"""
import logging

from django.conf import settings
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Cliente singleton reutilizado entre chamadas
_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


# MVP: apenas complete() para geração de trilha (sem streaming ainda)
async def complete(system_prompt: str, user_message: str, model: str | None = None) -> str:
    """
    Envia uma requisição de completion para a OpenAI e retorna a resposta como string.
    Usa response_format=json_object — o sistema_prompt deve solicitar JSON explicitamente.
    """
    resolved_model = model or settings.OPENAI_MODEL
    client = get_client()

    logger.info(
        "LLM request | model=%s | system_len=%d | user_len=%d",
        resolved_model,
        len(system_prompt),
        len(user_message),
    )

    response = await client.chat.completions.create(
        model=resolved_model,
        max_tokens=settings.OPENAI_MAX_TOKENS,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )

    content = response.choices[0].message.content or ""
    logger.info("LLM response | tokens_used=%d", response.usage.total_tokens if response.usage else 0)
    return content


async def stream_chat(system_prompt: str, user_message: str, model: str | None = None):
    """
    Gerador assíncrono de tokens para uso com StreamingHttpResponse (SSE).
    Ao contrário de complete(), não usa response_format=json_object — retorna texto livre.
    """
    resolved_model = model or settings.OPENAI_MODEL
    client = get_client()

    logger.info(
        "LLM stream request | model=%s | system_len=%d | user_len=%d",
        resolved_model,
        len(system_prompt),
        len(user_message),
    )

    stream = await client.chat.completions.create(
        model=resolved_model,
        stream=True,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )
    async for chunk in stream:
        token = chunk.choices[0].delta.content if chunk.choices else None
        if token:
            yield token

# TODO FASE 3: integração Thesys C1
# Substituir stream_chat por chamada ao endpoint C1 da Thesys
# que retorna componentes React em vez de tokens de texto
# Ref: https://docs.thesys.dev
# SDK: @thesysai/genui-sdk
# Modelos recomendados: Claude Sonnet 4 ou GPT-5
# PRÉ-REQUISITOS antes de iniciar:
#   - MVP validado com usuários reais
#   - Custo OpenAI atual mapeado
#   - Thesys C1 com suporte mobile estável
