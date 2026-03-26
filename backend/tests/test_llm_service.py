"""
Testes do serviço LLM.
Usa pytest-asyncio e model-bakery. Zero chamadas reais à OpenAI.
"""
import json
from unittest.mock import AsyncMock, patch

import pytest
from asgiref.sync import sync_to_async
from model_bakery import baker

from concurseai.apps.concursos.models import Concurso
from concurseai.apps.llm.service import LLMServiceError, gerar_trilha_para_concurso
from concurseai.apps.trilhas.models import Modulo, Trilha

pytestmark = pytest.mark.django_db(transaction=True)

MODULOS_VALIDOS = {
    "modulos": [
        {
            "nome": "Direito Constitucional",
            "ordem": 1,
            "peso": 0.4,
            "topicos": [
                {
                    "nome": "Princípios fundamentais",
                    "subtopicos": [
                        "Dignidade da pessoa humana como fundamento da República",
                        "Separação dos Poderes: independência e harmonia",
                        "Princípio federativo: repartição de competências",
                    ],
                },
                {
                    "nome": "Direitos individuais",
                    "subtopicos": [
                        "Direito à vida: aborto e pena de morte nas exceções constitucionais",
                        "Igualdade formal vs. igualdade material",
                        "Liberdade de locomoção e habeas corpus",
                    ],
                },
            ],
        },
        {
            "nome": "Português",
            "ordem": 2,
            "peso": 0.3,
            "topicos": [
                {
                    "nome": "Interpretação de texto",
                    "subtopicos": [
                        "Identificação de ideia central vs. ideia secundária",
                        "Inferências e pressupostos",
                    ],
                },
                {
                    "nome": "Gramática",
                    "subtopicos": [
                        "Concordância verbal com sujeito posposto",
                        "Regência verbal: verbos de dupla regência",
                    ],
                },
            ],
        },
        {
            "nome": "Raciocínio Lógico",
            "ordem": 3,
            "peso": 0.3,
            "topicos": [
                {
                    "nome": "Proposições",
                    "subtopicos": [
                        "Negação de proposições compostas (De Morgan)",
                        "Contrapositiva e equivalências lógicas",
                    ],
                },
                {
                    "nome": "Tabela-verdade",
                    "subtopicos": [
                        "Construção de tabela-verdade para conectivos básicos",
                        "Tautologia, contradição e contingência",
                    ],
                },
            ],
        },
    ]
}


@pytest.mark.asyncio
async def test_gerar_trilha_sem_edital_lanca_erro():
    """Concurso com edital_texto vazio deve lançar LLMServiceError."""
    concurso = await sync_to_async(baker.make)(Concurso, edital_texto="", cargo="Analista")

    with pytest.raises(LLMServiceError, match="não possui texto de edital"):
        await gerar_trilha_para_concurso(concurso)


@pytest.mark.asyncio
async def test_gerar_trilha_retorna_modulos():
    """LLM mockada com JSON válido deve retornar dict com módulos."""
    concurso = await sync_to_async(baker.make)(Concurso, edital_texto="Conteúdo do edital...", cargo="Analista")

    with patch(
        "concurseai.apps.llm.service.client.complete",
        new=AsyncMock(return_value=json.dumps(MODULOS_VALIDOS)),
    ):
        resultado = await gerar_trilha_para_concurso(concurso)

    assert "modulos" in resultado
    assert len(resultado["modulos"]) == 3
    assert resultado["modulos"][0]["nome"] == "Direito Constitucional"


@pytest.mark.asyncio
async def test_gerar_trilha_json_invalido_lanca_erro():
    """LLM retornando string inválida deve lançar LLMServiceError."""
    concurso = await sync_to_async(baker.make)(Concurso, edital_texto="Conteúdo do edital...", cargo="Analista")

    with patch(
        "concurseai.apps.llm.service.client.complete",
        new=AsyncMock(return_value="isso não é json {{{"),
    ):
        with pytest.raises(LLMServiceError, match="formato inválido"):
            await gerar_trilha_para_concurso(concurso)


@pytest.mark.asyncio
async def test_gerar_trilha_salva_no_banco():
    """
    Após chamar gerar_trilha_para_concurso e persistir via view logic,
    Trilha e Modulos devem existir no banco.
    """
    from concurseai.apps.users.models import User

    usuario = await sync_to_async(baker.make)(User, email="teste@concurseai.com")
    concurso = await sync_to_async(baker.make)(Concurso, edital_texto="Conteúdo do edital...", cargo="Técnico")

    with patch(
        "concurseai.apps.llm.service.client.complete",
        new=AsyncMock(return_value=json.dumps(MODULOS_VALIDOS)),
    ):
        data = await gerar_trilha_para_concurso(concurso)

    # Simula o que a view faz após receber o dict
    trilha = await Trilha.objects.acreate(usuario=usuario, concurso=concurso)
    for mod_data in data["modulos"]:
        await Modulo.objects.acreate(
            trilha=trilha,
            nome=mod_data["nome"],
            ordem=mod_data["ordem"],
            peso=mod_data["peso"],
            topicos=mod_data["topicos"],
        )

    # Verificações
    assert await Trilha.objects.filter(usuario=usuario, concurso=concurso).aexists()
    modulos_count = await Modulo.objects.filter(trilha=trilha).acount()
    assert modulos_count == 3

    primeiro_modulo = await Modulo.objects.filter(trilha=trilha, ordem=1).afirst()
    assert primeiro_modulo is not None
    assert primeiro_modulo.nome == "Direito Constitucional"
    assert primeiro_modulo.peso == 0.4
