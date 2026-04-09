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
    Instrui a LLM a gerar 5 questões cobrindo subtópicos, tópicos e módulo,
    com dificuldade escalonada (fácil → difícil) no estilo da banca.
    Retorna JSON — usado com client.complete() (response_format=json_object).
    """
    banca_instrucao = ""
    if banca:
        estilos = {
            "CESPE": "afirmações certo/errado adaptadas para A/B/C/D, com pegadinhas em exceções e casos-limite.",
            "CEBRASPE": "afirmações certo/errado adaptadas para A/B/C/D, com pegadinhas em exceções e casos-limite.",
            "FGV": "enunciados com situações-problema e casos práticos, exigindo raciocínio aplicado.",
            "FCC": "questões diretas de memorização de regras, classificações e definições.",
            "VUNESP": "questões com foco em aplicação de normas e classificações objetivas.",
        }
        estilo = estilos.get(banca.upper(), f"questões no estilo típico da banca {banca}.")
        banca_instrucao = f"\n\nEstilo da banca {banca}: {estilo}"

    return (
        f"Você é um elaborador sênior de questões para concursos públicos brasileiros, "
        f"especializado em {modulo_nome}.{banca_instrucao}\n\n"
        "Gere EXATAMENTE 5 questões de múltipla escolha (A, B, C, D) "
        "seguindo esta DISTRIBUIÇÃO OBRIGATÓRIA de cobertura e dificuldade:\n\n"
        "Q1 — FÁCIL (subtópico): avalia um subtópico isolado — definição direta, "
        "conceito básico ou recall simples. Candidato que leu o material acerta.\n"
        "Q2 — FÁCIL/MÉDIO (subtópico): avalia outro subtópico com leve interpretação — "
        "reconhecimento com aplicação simples.\n"
        "Q3 — MÉDIO (tópico): integra 2+ subtópicos do mesmo tópico em situação-problema. "
        "Exige compreensão, não apenas memorização.\n"
        "Q4 — MÉDIO/DIFÍCIL (tópico): situação-problema mais elaborada, exceção à regra "
        "ou contraste entre dois tópicos diferentes.\n"
        "Q5 — DIFÍCIL (módulo): avalia domínio do módulo inteiro — cruza tópicos distantes, "
        "edge case, pegadinha típica da banca ou caso especial que pega quem só decorou.\n\n"
        "REGRAS OBRIGATÓRIAS:\n"
        "1. Retorne APENAS JSON válido, sem texto extra.\n"
        '2. Estrutura raiz: {"questoes": [...]}\n'
        "3. Cada questão: "
        '{"enunciado": string, "alternativas": {"A": string, "B": string, "C": string, "D": string}, '
        '"gabarito": "A"|"B"|"C"|"D", "explicacao": string, '
        '"dificuldade": "facil"|"medio"|"dificil", "nivel": "subtopico"|"topico"|"modulo"}\n'
        "4. Apenas uma alternativa correta; as demais devem ser plausíveis (não óbvias).\n"
        "5. A explicação justifica o gabarito E menciona por que cada distrator está errado.\n"
        "6. Varie a posição do gabarito (não repita a mesma letra mais de 2 vezes).\n"
        "7. Os enunciados devem ser autocontidos — não referencie 'o texto acima' ou 'a lei X'."
    )


def user_gerar_quiz(modulo_nome: str, topicos: list) -> str:
    """Formata tópicos e subtópicos do módulo para cobertura granular no quiz."""
    linhas = []
    for t in topicos[:8]:
        if isinstance(t, dict):
            linhas.append(f"Tópico: {t['nome']}")
            for sub in t.get("subtopicos", [])[:5]:
                linhas.append(f"  • {sub}")
        else:
            linhas.append(f"Tópico: {t}")

    conteudo = "\n".join(linhas) if linhas else modulo_nome

    return (
        f"Módulo: {modulo_nome}\n\n"
        f"Conteúdo disponível (tópicos e subtópicos):\n{conteudo}\n\n"
        "Gere as 5 questões respeitando a distribuição de cobertura e dificuldade solicitada."
    )


# TODO FASE 2: system_analisar_compatibilidade() — para matching candidato × edital
# def system_analisar_compatibilidade() -> str:
#     ...

# TODO FASE 2: system_gerar_quiz(modulo, subtopico) — quiz granular por subtópico
# def system_gerar_quiz(modulo: str, subtopico: str) -> str:
#     ...
