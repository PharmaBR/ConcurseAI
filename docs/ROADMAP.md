# ConcurseAI — Roadmap

## FASE 1 — MVP (2 semanas)

Hipótese a validar: **"A LLM consegue gerar uma trilha útil a partir de um edital real?"**

| Dia | Funcionalidade |
|-----|---------------|
| 1–2 | Auth — cadastro, login, JWT |
| 3   | Cadastro de editais via Django Admin |
| 4–5 | Testes + ajustes |
| 8–9 | Geração de trilha via LLM |
| 10  | Listagem e busca de concursos |
| 11  | Salvar concursos favoritos |
| 12–13 | Progresso por módulo da trilha |
| 14  | Buffer / apresentação |

### Entregáveis do MVP
- [x] Autenticação JWT (registro + login)
- [x] Painel admin para cadastro de editais
- [x] Endpoint `POST /api/llm/trilha/<uuid>/` gerando trilha estruturada
- [x] Listagem de concursos com filtros (status, área, banca)
- [x] Salvar/remover concursos favoritos
- [x] Marcar progresso por módulo da trilha
- [x] Scaffolding pedagógico: subtópicos granulares e banca-aware por tópico

---

## FASE 2 — Pós-validação

Após confirmar que a hipótese do MVP é válida com usuários reais.

### Chat streaming SSE
- Endpoint `POST /api/llm/explicar/` com `StreamingHttpResponse`
- Hook `useLLMStream.ts` no frontend
- Componente `ChatExplicacao.tsx` por módulo de trilha

### Análise de compatibilidade
- `system_analisar_compatibilidade()` em `prompts.py`
- `ConcursoCompatibilidadeView` — análise LLM de perfil candidato × edital
- Campo `areas_conhecimento` (JSONField) em `Concurso`
- Campo `score_compatibilidade` (FloatField) em `Trilha`

### Quiz por módulo
- `system_gerar_quiz(modulo, topicos)` em `prompts.py`
- FK `QuizGerado` em `Modulo`
- `TrilhaQuizView` — geração de questões por módulo via LLM

### Notificações de editais
- `NotificacoesView` — preferências de alerta de editais
- Campos de preferências no modelo `User`
- Tarefa Celery para monitorar editais abertos

### Histórico de perguntas
- Model `HistoricoPerguntas` por usuário e módulo
- API de consulta e exportação

---

## FASE 3 — Thesys C1 (opcional)

> **Pré-requisitos obrigatórios antes de iniciar:**
> - MVP validado com usuários reais
> - Custo OpenAI atual mapeado e sustentável
> - Thesys C1 com suporte mobile estável

### O que é o Thesys C1
API de Generative UI que substitui respostas em texto/markdown por componentes React interativos gerados dinamicamente pela LLM.

### Por que faz sentido para o ConcurseAI
- Trilha como cards interativos com ações embutidas
- Análise de edital como tabela dinâmica filtrável
- Módulos com visualizações de progresso geradas pela IA
- Experiência muito superior ao markdown estático

### Como plugar sem reescrever o backend
1. Trocar `<Markdown>` por `<C1Component>` no frontend — o backend permanece igual
2. Adicionar `THESYS_API_KEY` no `.env`
3. Criar `useThesysC1.ts` hook substituindo `useLLMStream.ts`
4. Implementar `C1Renderer.tsx` para renderização dos componentes

### Referências
- Documentação: https://docs.thesys.dev
- SDK: `@thesysai/genui-sdk`
- Modelos recomendados: Claude Sonnet 4 ou GPT-5

---

## Fora do roadmap
Os itens abaixo não serão desenvolvidos neste produto:
- Lives e aulas ao vivo
- Fórum de discussão entre candidatos
- Análise de gabarito individual
- Geração de horários por rotina pessoal
