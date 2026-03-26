# ConcurseAI

SaaS de preparação para concursos públicos com IA.

## Hipótese MVP
> "A LLM consegue gerar uma trilha útil a partir de um edital real?"

## Stack
- **Backend**: Django 5, DRF, Celery, PostgreSQL, Redis
- **Frontend**: Next.js (TypeScript)
- **LLM**: OpenAI gpt-4o-mini (via SDK oficial)
- **Auth**: JWT (SimpleJWT)

## Início rápido

```bash
cp .env.example .env
# Edite .env com suas chaves

docker-compose up --build
```

Acesse:
- API: http://localhost:8000/api/
- Admin: http://localhost:8000/admin/
- Frontend: http://localhost:3000

## Estrutura
```
concurseai/
├── backend/   # Django + DRF
├── frontend/  # Next.js
└── docs/      # ADRs e Roadmap
```

## Alimentando o sistema

1. Acesse `/admin/`
2. Crie uma **Banca** (ex.: CESPE/CEBRASPE)
3. Crie um **Concurso** e cole o texto do edital no campo "Conteúdo do Edital"
4. Use o endpoint `POST /api/llm/trilha/<uuid>/` para gerar a trilha

## Roadmap

Veja [docs/ROADMAP.md](docs/ROADMAP.md) para as fases planejadas.
# ConcurseAI
