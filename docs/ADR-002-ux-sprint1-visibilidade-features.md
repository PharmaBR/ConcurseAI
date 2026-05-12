# ADR-002 — UX Sprint 1: Visibilidade das Features de IA

**Status:** Aceito  
**Data:** 2026-05  
**Revisão:** Após feedback de 10+ usuários reais

---

## Contexto

Após o MVP funcional, uma análise de UX identificou que as features de maior valor do produto
(quiz progressivo, chat com IA, flashcards) eram praticamente invisíveis para o usuário.
Estavam renderizadas como links de texto em `text-xs` no fundo do ModuloCard — fáceis de ignorar,
impossíveis de descobrir organicamente.

O resultado prático: usuários conseguiam *gerar uma trilha*, mas não sabiam que podiam *estudar com ela*.

### Problemas mapeados (por prioridade)

| # | Problema | Impacto |
|---|----------|---------|
| P1 | Features de IA (quiz, chat, flashcards) renderizadas como texto minúsculo | Usuário não descobre as features principais |
| P2 | Sem guia de próximo passo — trilha gerada fica estática sem orientação | Abandono pós-geração |
| P3 | Trilha sem contexto do concurso (só "Sua Trilha de Estudos") | Desorientação na página |
| P4 | `alert()` nativo para erros em ConcursoCard | Percepção de produto amador |
| P5 | Hierarquia visual plana nos botões do ConcursoCard | CTA principal não se destaca |

---

## Decisão

### 1. Redesenho do bloco de ações IA no ModuloCard

**Antes:** 3 links de texto `text-xs` alinhados horizontalmente no rodapé do card.

**Depois:** Grid 3 colunas com botões visuais coloridos, cada um com ícone grande,
título e subtítulo contextual (score de proficiência, contador de flashcards pendentes).

Cada ação tem uma cor semântica própria:
- 💬 **Chat IA** — azul (informação, aprendizado)
- 📝 **Quiz** — roxo (avaliação, diagnóstico)
- 📚 **Flashcards** — laranja (revisão, fixação)

**Justificativa:** Affordance direta. Botões com área clicável ampla e rótulo descritivo
eliminam a necessidade de o usuário "descobrir" que aquilo é uma feature.

### 2. Banner de próximo passo contextual no TrilhaView

Exibe um hint diferente de acordo com o estado do usuário:
- **Primeira vez (sem dados):** orienta a fazer o primeiro quiz
- **Com erros/flashcards pendentes:** direciona para revisão
- **Tudo dominado:** parabeniza e sugere próximo módulo

**Justificativa:** Remove a ambiguidade pós-geração de trilha. O usuário sempre sabe o que fazer.

### 3. Cabeçalho da trilha com contexto do concurso

A página `/trilha/[id]` passa a exibir **órgão + cargo + banca** no cabeçalho,
além do progresso geral.

Para isso, o `TrilhaSerializer` do backend passa a retornar `concurso` como objeto aninhado
(`{id, orgao, cargo, banca_sigla}`) em vez de apenas o UUID.

**Justificativa:** Usuário com múltiplas trilhas consegue distinguir em qual está sem precisar voltar.

### 4. Substituição de `alert()` por estado de erro inline

`ConcursoCard` passa a renderizar mensagens de erro como bloco vermelho
no próprio card, sem interromper o fluxo com modal nativo do browser.

---

## Consequências positivas

- Features de IA passam a ter visibilidade proporcional ao valor que entregam
- Usuário novo tem uma jornada guiada sem onboarding extra
- Código de erro deixa de usar API não-React (`alert`)
- Serializer da trilha fica mais rico sem custo de query adicional
  (usando `select_related` já existente nas views)

## Consequências negativas (e mitigações)

| Problema | Mitigação |
|----------|-----------|
| ModuloCard fica mais alto visualmente | Blocos de ação são compactos (h~80px); peso visual compensado pela clareza |
| Breaking change no campo `concurso` do serializer | `page.tsx` já tratava `concurso` como `string \| {id: string}` — compatível |
| Banner de hint pode ser repetitivo para usuários avançados | Banner some após primeiro quiz no módulo (`proficiencia` preenchida) |

## Alternativas consideradas

### Tooltip / popover de onboarding
- **Rejeitado:** requer estado de "já viu o tour" no backend/localStorage;
  mais complexidade para o mesmo resultado.

### Tab navigation dentro do ModuloCard (Chat / Quiz / Flashcards como abas)
- **Rejeitado:** esconde o conteúdo atrás de uma interação extra;
  o objetivo é tornar as features *visíveis*, não apenas organizadas.

### Página dedicada por módulo (`/trilha/[id]/modulo/[mid]`)
- **Rejeitado para Sprint 1:** muda a arquitetura de navegação;
  adequado para Sprint 3+ quando houver mais conteúdo por módulo.

---

## Critério de revisão

Reavaliar esta decisão quando:
- Taxa de clique nas ações de IA atingir > 60% dos usuários que abrem uma trilha
- Feedback qualitativo indicar que o layout ficou denso demais em mobile
- Sprint 2 for iniciado (banner de "continuar estudando" na homepage)

---

*Próxima decisão prevista: ADR-003 — Upload de edital pelo usuário (PDF/URL)*
