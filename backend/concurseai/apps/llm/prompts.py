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


def system_explicar_conteudo(modulo_nome: str) -> str:
    """
    Instrui a LLM a atuar como professor de concursos para um módulo específico.
    Respostas em texto livre (sem JSON) — usada com stream_chat().
    """
    return (
        f"Você é um professor especializado em concursos públicos brasileiros, "
        f"com foco em {modulo_nome}. "
        "Explique os conteúdos de forma didática, clara e objetiva, "
        "adaptada para candidatos em preparação para concursos. "
        "Use exemplos práticos e situações reais quando relevante. "
        "Seja direto e conciso. Responda sempre em português brasileiro."
    )


def user_explicar_conteudo(pergunta: str, modulo_nome: str, topico_nome: str = "") -> str:
    """Formata a pergunta do candidato com o contexto do módulo/tópico."""
    contexto = f"Estou estudando {modulo_nome}"
    if topico_nome:
        contexto += f", especificamente: {topico_nome}"
    return f"{contexto}.\n\nMinha dúvida: {pergunta}"


def system_gerar_quiz(modulo_nome: str, banca: str = "") -> str:
    """
    Instrui a LLM a gerar questões de múltipla escolha no estilo da banca.
    Retorna JSON — usado com client.complete() (response_format=json_object).
    """
    banca_instrucao = ""
    if banca:
        banca_instrucao = (
            f"\nAdapte o estilo das questões à banca {banca}: "
            "CESPE/CEBRASPE usa certo/errado e afirmações com pegadinhas; "
            "FGV e FCC usam 4-5 alternativas com situações-problema."
        )

    return (
        f"Você é um elaborador de questões de concursos públicos especializado em {modulo_nome}."
        f"{banca_instrucao}\n\n"
        "Gere exatamente 5 questões de múltipla escolha (A, B, C, D) com base nos tópicos fornecidos.\n\n"
        "REGRAS OBRIGATÓRIAS:\n"
        "1. Retorne APENAS JSON válido, sem texto extra.\n"
        '2. Estrutura raiz: {"questoes": [...]}\n'
        "3. Cada questão: "
        '{"enunciado": string, "alternativas": {"A": string, "B": string, "C": string, "D": string}, '
        '"gabarito": "A"|"B"|"C"|"D", "explicacao": string}\n'
        "4. O enunciado deve ser claro e testar uma competência específica.\n"
        "5. Apenas uma alternativa correta; as outras devem ser plausíveis (não óbvias).\n"
        "6. A explicação deve justificar o gabarito e mencionar por que as outras estão erradas.\n"
        "7. Varie a posição do gabarito entre A, B, C e D.\n"
        "8. Nível de dificuldade: intermediário a avançado."
    )


def user_gerar_quiz(modulo_nome: str, topicos: list) -> str:
    """Formata os tópicos do módulo para geração do quiz."""
    topicos_texto = "\n".join(
        f"- {t['nome'] if isinstance(t, dict) else t}" for t in topicos[:10]
    )
    return (
        f"Módulo: {modulo_nome}\n\n"
        f"Tópicos a cobrir:\n{topicos_texto}\n\n"
        "Gere 5 questões de múltipla escolha cobrindo esses tópicos."
    )


# TODO FASE 2: system_analisar_compatibilidade() — para matching candidato × edital
# def system_analisar_compatibilidade() -> str:
#     ...

# TODO FASE 2: system_gerar_quiz(modulo, subtopico) — quiz granular por subtópico
# def system_gerar_quiz(modulo: str, subtopico: str) -> str:
#     ...
