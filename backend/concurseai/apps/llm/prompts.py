"""
Todos os prompts da aplicação centralizados aqui.
MVP: apenas os prompts necessários para gerar trilha de estudo.
"""

# Limite de caracteres do edital enviado à LLM
EDITAL_MAX_CHARS = 6000


def system_gerar_trilha() -> str:
    """
    Instrui a LLM a retornar um JSON com a trilha de estudo com scaffolding pedagógico.

    Estrutura esperada:
    {
      "modulos": [
        {
          "nome": "Direito Constitucional",
          "ordem": 1,
          "peso": 0.25,
          "topicos": [
            {
              "nome": "Direitos e garantias fundamentais",
              "subtopicos": [
                "Direitos individuais: vida, liberdade, igualdade",
                "Direitos e deveres coletivos",
                "Remédios constitucionais: HC, MS, MI, HD, AP",
                "Direitos sociais: rol do art. 6º",
                "Direitos políticos e perda/suspensão"
              ]
            },
            ...
          ]
        }
      ]
    }
    """
    return """Você é um especialista em concursos públicos brasileiros com profundo conhecimento \
pedagógico e das bancas examinadoras (CESPE/CEBRASPE, FGV, FCC, VUNESP, QUADRIX, etc.).

Sua tarefa é analisar o texto de um edital e gerar uma trilha de estudo com SCAFFOLDING PEDAGÓGICO — \
ou seja, cada tópico é decomposto em subtópicos granulares e testáveis individualmente.

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS JSON válido, sem texto extra, sem markdown.
2. Estrutura raiz: {"modulos": [...]}
3. Cada módulo: "nome" (string), "ordem" (inteiro), "peso" (float), "topicos" (lista de objetos).
4. Cada tópico: {"nome": string, "subtopicos": [string, ...]}
5. "peso": proporção histórica de questões da disciplina (todos os pesos somam 1.0).
6. Máximo de 12 módulos.
7. Inclua APENAS disciplinas explicitamente mencionadas no edital.
8. Ordene módulos do maior peso para o menor.

REGRAS PARA OS SUBTÓPICOS (crítico para a qualidade pedagógica):
9.  Cada subtópico deve ser uma COMPETÊNCIA TESTÁVEL INDIVIDUALMENTE — específica o suficiente \
para gerar uma questão isolada.
10. Use entre 4 e 8 subtópicos por tópico.
11. Adapte a granularidade ao ESTILO DA BANCA:
    - CESPE/CEBRASPE: foque em casos-limite, exceções e pegadinhas típicas.
    - FGV: foque em conceitos teóricos e aplicação em situações-problema.
    - FCC/VUNESP: foque em memorização de regras, classificações e exemplos.
    - Banca desconhecida: use granularidade equilibrada entre teoria e prática.
12. Ordene subtópicos do mais fundamental ao mais complexo (scaffolding progressivo).
13. Nomeie cada subtópico como uma competência clara: prefira \
"Concordância verbal com sujeito posposto" a "Concordância verbal"."""


def user_gerar_trilha(edital_texto: str, cargo: str, banca: str = "") -> str:
    """Formata o input do edital para a LLM, incluindo o contexto da banca."""
    texto_truncado = edital_texto[:EDITAL_MAX_CHARS]
    truncado_aviso = (
        "\n[TEXTO TRUNCADO — analise apenas o conteúdo acima]"
        if len(edital_texto) > EDITAL_MAX_CHARS
        else ""
    )
    banca_info = f"Banca examinadora: {banca}" if banca else "Banca examinadora: não informada"
    return f"""Cargo: {cargo}
{banca_info}

Texto do edital:
{texto_truncado}{truncado_aviso}

Gere a trilha de estudos com scaffolding pedagógico para este concurso."""


# TODO FASE 2: system_explicar_conteudo(disciplina, subtopico) — para chat streaming
# def system_explicar_conteudo(disciplina: str, subtopico: str) -> str:
#     """Instrui a LLM a explicar um subtópico específico de forma didática."""
#     ...

# TODO FASE 2: system_analisar_compatibilidade() — para matching candidato × edital
# def system_analisar_compatibilidade() -> str:
#     """Instrui a LLM a comparar o perfil do candidato com os requisitos do edital."""
#     ...

# TODO FASE 2: system_gerar_quiz(modulo, subtopico) — quiz granular por subtópico
# def system_gerar_quiz(modulo: str, subtopico: str) -> str:
#     """Instrui a LLM a gerar questões no estilo da banca para um subtópico específico."""
#     ...
