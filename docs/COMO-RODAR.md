# Como rodar o ConcurseAI (estado atual do MVP)

> **Pré-requisitos:** Python 3.13, PostgreSQL local rodando, Redis (opcional — só necessário para Celery)

---

## 1. Configurar variáveis de ambiente

O `.env` já está criado em `backend/.env` e na raiz. Verifique que `OPENAI_API_KEY` está preenchida:

```
backend/.env
├── OPENAI_API_KEY=sk-proj-...   ← obrigatório
├── SECRET_KEY=troque-isso...    ← trocar em produção
├── POSTGRES_DB=concurseai
├── POSTGRES_USER=concurseai
├── POSTGRES_PASSWORD=concurseai
├── OPENAI_MODEL=gpt-4o-mini
└── OPENAI_MAX_TOKENS=2048
```

---

## 2. Backend (Django + uvicorn)

```bash
cd backend

# Criar e ativar virtualenv (só na primeira vez)
python3 -m venv .venv
source .venv/bin/activate

# Instalar dependências (só na primeira vez)
pip install -r requirements.txt

# Rodar migrations
DJANGO_SETTINGS_MODULE=concurseai.settings.dev python manage.py migrate

# Criar superusuário (só na primeira vez)
DJANGO_SETTINGS_MODULE=concurseai.settings.dev python manage.py createsuperuser

# Subir servidor ASGI (obrigatório — views LLM são async)
DJANGO_SETTINGS_MODULE=concurseai.settings.dev .venv/bin/uvicorn concurseai.asgi:application --reload --port 8000
```

> **Por que uvicorn e não `runserver`?**
> As views do app `llm` são `async def`. O `runserver` usa WSGI e o `@api_view` do DRF não faz `await` em coroutines no modo síncrono.

---

## 3. Rodar os testes

```bash
cd backend

# Configurar DB de teste (usa o mesmo banco, cria schema temporário)
DJANGO_SETTINGS_MODULE=concurseai.settings.dev .venv/bin/pytest tests/ -v
```

Saída esperada — 4 testes passando, zero chamadas reais à OpenAI:

```
tests/test_llm_service.py::test_gerar_trilha_sem_edital_lanca_erro  PASSED
tests/test_llm_service.py::test_gerar_trilha_retorna_modulos        PASSED
tests/test_llm_service.py::test_gerar_trilha_json_invalido_lanca_erro PASSED
tests/test_llm_service.py::test_gerar_trilha_salva_no_banco         PASSED
```

---

## 4. Fluxo completo via API (curl)

### 4.1 Registrar usuário

```bash
curl -X POST http://localhost:8000/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@teste.com","username":"joao","password":"senha123"}'
```

### 4.2 Obter token JWT

```bash
curl -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@teste.com","password":"senha123"}'
# → {"access": "eyJ...", "refresh": "eyJ..."}

TOKEN="eyJ..."   # copie o access token
```

### 4.3 Listar concursos (público)

```bash
curl http://localhost:8000/api/concursos/

# Filtros disponíveis:
curl "http://localhost:8000/api/concursos/?status=aberto"
curl "http://localhost:8000/api/concursos/?area=federal"
```

### 4.4 Gerar trilha via LLM

```bash
# Substitua <UUID> pelo id do concurso retornado na listagem
curl -X POST http://localhost:8000/api/llm/trilha/<UUID>/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Resposta (~10-15s):
# {
#   "trilha_id": "5b205a4f-...",
#   "modulos": [
#     {"nome": "Direito Constitucional", "peso": 0.25, "topicos": [...], ...},
#     ...
#   ]
# }
```

### 4.5 Ver trilha salva

```bash
curl http://localhost:8000/api/trilhas/<trilha_id>/ \
  -H "Authorization: Bearer $TOKEN"
```

### 4.6 Avançar progresso de um módulo

```bash
# <modulo_id> é o campo "id" retornado dentro de "modulos"
curl -X PATCH http://localhost:8000/api/trilhas/modulos/<modulo_id>/avancar/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"progresso": 75.0}'
# progresso 100.0 marca o módulo como "concluido" automaticamente
```

### 4.7 Salvar concurso favorito

```bash
curl -X POST http://localhost:8000/api/concursos/salvos/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"concurso_id": "<UUID>"}'
```

---

## 5. Django Admin

Acesse `http://localhost:8000/admin/` com o superusuário criado.

Fluxo para adicionar um concurso manualmente:

1. **Bancas → Adicionar** — preencha sigla, nome e site
2. **Concursos → Adicionar** — preencha órgão, cargo, banca, status
3. Em **"Conteúdo do Edital"** (seção colapsável) — cole o texto extraído do PDF do edital
4. Salve → use o endpoint `POST /api/llm/trilha/<id>/` para gerar a trilha

---

## 6. URLs disponíveis

| Método | URL | Auth | Descrição |
|--------|-----|------|-----------|
| POST | `/api/users/register/` | ✗ | Cadastro |
| GET/PATCH | `/api/users/me/` | ✓ | Perfil do usuário |
| POST | `/api/auth/token/` | ✗ | Login (JWT) |
| POST | `/api/auth/token/refresh/` | ✗ | Renovar token |
| GET | `/api/concursos/` | ✗ | Listar concursos |
| GET | `/api/concursos/<uuid>/` | ✗ | Detalhe de concurso |
| GET/POST | `/api/concursos/salvos/` | ✓ | Favoritos |
| DELETE | `/api/concursos/salvos/<id>/` | ✓ | Remover favorito |
| GET | `/api/trilhas/` | ✓ | Minhas trilhas |
| GET | `/api/trilhas/<uuid>/` | ✓ | Detalhe da trilha |
| PATCH | `/api/trilhas/modulos/<id>/avancar/` | ✓ | Avançar módulo |
| POST | `/api/llm/trilha/<uuid>/` | ✓ | **Gerar trilha via LLM** |

---

## 7. Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| `Connection error` na LLM | `OPENAI_API_KEY` não carregada | Reinicie o uvicorn após editar `.env` |
| `AssertionError: received coroutine` | Rodando com `runserver` (WSGI) | Use `uvicorn` (ver passo 2) |
| `relation does not exist` | Migrations não rodadas | `python manage.py migrate` |
| Token inválido 401 | Access token expirou (1h) | Use `/api/auth/token/refresh/` |
