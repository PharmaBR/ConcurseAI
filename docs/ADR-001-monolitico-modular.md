# ADR-001 — Arquitetura Monolítica Modular

**Status:** Aceito
**Data:** 2025-01
**Revisão:** Reavaliar com > 500 usuários simultâneos

---

## Contexto

O ConcurseAI está em fase de MVP com as seguintes restrições:
- **Time:** 1 desenvolvedor
- **Prazo:** 2 semanas para MVP funcional
- **Hipótese:** Validar se a LLM gera trilhas úteis a partir de editais reais
- **Infraestrutura:** Mínima — Docker Compose local, deploy simples

## Decisão

Adotar **arquitetura monolítica modular** com Django em vez de microserviços.

A aplicação é dividida em módulos bem delimitados dentro do mesmo processo:
- `apps/users` — autenticação e planos
- `apps/concursos` — editais e concursos
- `apps/trilhas` — trilhas e módulos de estudo
- `apps/llm` — integração com OpenAI

## Consequências positivas

- **Velocidade de desenvolvimento:** 1 dev consegue entregar o MVP em 2 semanas
- **Simplicidade operacional:** Docker Compose com 4 serviços (postgres, redis, backend, frontend)
- **Facilidade de debugging:** tudo em um processo, logs centralizados
- **Iteração rápida:** mudanças de schema não exigem coordenação entre serviços
- **Sem overhead de rede** entre módulos — chamadas são funções Python diretas
- **Celery já isola** as tarefas assíncronas naturalmente

## Consequências negativas (e mitigações)

| Problema | Mitigação adotada |
|----------|------------------|
| Acoplamento acidental entre módulos | Módulos se comunicam apenas por imports explícitos, sem acesso direto a modelos de outros apps |
| Escala vertical limitada | Aceitável até ~500 usuários simultâneos — reavaliar neste ponto |
| Deploy "tudo ou nada" | Celery como worker separado permite escalar tasks LLM independentemente |

## Alternativas consideradas

### Microserviços
- **Rejeitado:** overhead de desenvolvimento, infraestrutura e debugging inaceitável para 1 dev em 2 semanas
- Faz sentido reavaliar após validação e crescimento de time

### Monolito puro (sem modularização)
- **Rejeitado:** dificulta migração futura para microserviços se necessário
- Módulos bem delimitados facilitam extração posterior

## Critério de revisão

Reavaliar esta decisão quando **qualquer uma** das condições abaixo for atingida:
- > 500 usuários simultâneos no horário de pico
- Time cresce para 3+ desenvolvedores
- Necessidade de deploys independentes por módulo
- Custo de escala vertical supera custo de migração

---

*Próxima revisão prevista após validação da hipótese do MVP.*
