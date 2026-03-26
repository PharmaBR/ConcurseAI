# Deploy — Hetzner VPS + Caddy

Stack completa num único servidor com SSL automático.

---

## 1. Criar o servidor na Hetzner

Acesse [hetzner.com/cloud](https://www.hetzner.com/cloud), crie um projeto e clique em **Add Server**.
Configure cada seção como abaixo:

### Location
```
Nuremberg (nbg1)   ← menor latência BR entre as opções disponíveis
```

### Image
```
Ubuntu 24.04 LTS
```

### Type
```
Shared vCPU → x86  →  CX22
  2 vCPU | 4 GB RAM | 40 GB SSD | 20 TB traffic
  ~€4.35/mês
```

### Networking
```
Public IPv4:     ✅ Enabled   ← obrigatório
Public IPv6:     ✅ Enabled   ← grátis, deixe ligado
Private network: ⬜ Disabled  ← só necessário com múltiplos servidores
```

### SSH Keys
No seu Mac, gere a chave (se ainda não tiver):
```bash
ssh-keygen -t ed25519 -C "concurseai-deploy"
cat ~/.ssh/id_ed25519.pub   # copie esta saída
```
Cole no painel → **Add SSH Key** → name: `meu-mac`

### Volumes
```
⬜ Não adicionar agora

O disco de 40 GB do CX22 é suficiente para o MVP.
Hetzner Volumes custam €0.052/GB/mês se precisar no futuro.
```

### Firewall
Clique em **"Create Firewall"** e configure as regras:

**Inbound (entrada):**
| Protocolo | Porta | Source            | Motivo                    |
|-----------|-------|-------------------|---------------------------|
| TCP       | 22    | 0.0.0.0/0, ::/0   | SSH — acesso ao servidor  |
| TCP       | 80    | 0.0.0.0/0, ::/0   | HTTP → Caddy redireciona para HTTPS |
| TCP       | 443   | 0.0.0.0/0, ::/0   | HTTPS — app em produção   |

**Outbound (saída):** deixe o padrão (all traffic liberado).

> ⚠️ **Não exponha as portas 8000, 3000, 5432 ou 6379.**
> Os containers ficam em rede interna do Docker — só o Caddy fica público.

### Backups
```
⬜ Desabilitado por enquanto (+20% do custo, ~€0.87/mês)
Habilite após validar o MVP com usuários reais.
```

### Labels (opcional)
```
project: concurseai
env:     production
```

### Name
```
concurseai-prod
```

Clique em **Create & Buy Now** e anote o **IP público** do servidor.

---

## 2. Apontar o domínio

No painel DNS do seu registrador, crie um registro A:

```
concurseai.com.br  →  A  →  <IP do servidor>
TTL: 300 (5 minutos)
```

> O Caddy obtém o certificado SSL automaticamente via Let's Encrypt.
> O domínio **precisa estar apontando** para o IP antes de iniciar o Caddy.
> Aguarde a propagação DNS (5–30 min) antes de continuar.

Verifique a propagação com:
```bash
dig concurseai.com.br +short   # deve retornar o IP do servidor
```

---

## 3. Configurar o servidor

```bash
# Conecte via SSH
ssh root@<IP>

# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker e Git
apt install -y docker.io docker-compose-plugin git

# Verificar
docker --version
docker compose version

# Instalar Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Verificar
caddy version
```

---

## 4. Clonar o projeto

```bash
git clone https://github.com/seu-usuario/concurseai.git /opt/concurseai
cd /opt/concurseai
```

---

## 5. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Preencha obrigatoriamente:

```env
# --- OpenAI ---
OPENAI_API_KEY=sk-...

# --- Django ---
# Gere com: python3 -c "import secrets; print(secrets.token_urlsafe(50))"
SECRET_KEY=...
DEBUG=False
ALLOWED_HOSTS=concurseai.com.br

# --- Banco de dados ---
POSTGRES_DB=concurseai
POSTGRES_USER=concurseai
POSTGRES_PASSWORD=senha-forte-aqui   # use algo como: openssl rand -base64 32

# --- CORS / Frontend ---
NEXT_PUBLIC_API_URL=https://concurseai.com.br   # sem barra no final
CORS_ALLOWED_ORIGINS=https://concurseai.com.br

# --- SSL (Caddy cuida do HTTPS, Django não precisa redirecionar) ---
SECURE_SSL_REDIRECT=False
```

---

## 6. Configurar o Caddy

```bash
# Copie o Caddyfile do projeto
cp /opt/concurseai/Caddyfile /etc/caddy/Caddyfile

# Substitua o domínio de exemplo pelo seu
sed -i 's/concurseai.com.br/SEU_DOMINIO/g' /etc/caddy/Caddyfile

# Confira o resultado
cat /etc/caddy/Caddyfile

# Valide a configuração
caddy validate --config /etc/caddy/Caddyfile

# Inicie / recarregue
systemctl enable caddy
systemctl restart caddy

# Confirme que está rodando
systemctl status caddy
```

---

## 7. Subir os containers

```bash
cd /opt/concurseai
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

A primeira build demora ~3–5 minutos (Next.js).

Acompanhe em tempo real:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

---

## 8. Criar superuser para o admin

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec backend python manage.py createsuperuser
```

Acesse `https://concurseai.com.br/admin/` para cadastrar editais.

---

## 9. Verificar tudo

```bash
# Status dos containers (todos devem estar "Up")
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Health check da API
curl https://concurseai.com.br/api/concursos/

# Logs do backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend --tail=50

# Logs do frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs frontend --tail=50

# Logs do Caddy (SSL)
journalctl -u caddy --tail=30
```

---

## Deploys futuros

```bash
cd /opt/concurseai
./deploy.sh
```

O script `deploy.sh` executa automaticamente:
1. `git pull origin main`
2. `docker compose up -d --build`
3. `manage.py migrate`
4. `manage.py collectstatic`

---

## Custos estimados

| Item | Custo |
|------|-------|
| Hetzner CX22 | ~€4.35/mês |
| Backups Hetzner (opcional) | ~€0.87/mês |
| Domínio .com.br | ~R$40/ano |
| OpenAI API (gpt-4o-mini) | ~$0.001 por trilha gerada |
| **Total fixo (sem backup)** | **~R$30/mês** |

---

## Troubleshooting

**Caddy não obtém certificado SSL**
```bash
journalctl -u caddy -f
# Causa mais comum: DNS ainda não propagou ou porta 80/443 bloqueada no firewall
dig concurseai.com.br +short   # deve retornar o IP do servidor
```

**Backend retorna 500**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend --tail=100
# Verifique: OPENAI_API_KEY, SECRET_KEY e POSTGRES_PASSWORD no .env
```

**Frontend não carrega**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs frontend --tail=50
# Verifique: NEXT_PUBLIC_API_URL sem barra no final e sem porta
```

**Banco de dados não conecta**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs db --tail=50
# Verifique: POSTGRES_USER, POSTGRES_DB e POSTGRES_PASSWORD consistentes no .env
```

**Porta 8000/3000 acessível externamente (não deveria)**
```bash
# No painel Hetzner → Firewall: remova qualquer regra expondo essas portas
# Apenas 22, 80 e 443 devem estar abertas
```
