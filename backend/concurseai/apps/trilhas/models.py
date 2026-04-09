# TODO FASE 2: campo 'score_compatibilidade' FloatField gerado pela LLM
import uuid

from django.conf import settings
from django.db import models


class Trilha(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trilhas",
    )
    concurso = models.ForeignKey(
        "concursos.Concurso",
        on_delete=models.CASCADE,
        related_name="trilhas",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("usuario", "concurso")
        verbose_name = "trilha"
        verbose_name_plural = "trilhas"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"Trilha de {self.usuario.email} — {self.concurso}"

    @property
    def progresso(self) -> float:
        """Retorna o percentual de módulos concluídos."""
        modulos = self.modulos.all()
        total = modulos.count()
        if total == 0:
            return 0.0
        concluidos = modulos.filter(status=Modulo.Status.CONCLUIDO).count()
        return round((concluidos / total) * 100, 1)


class QuizGerado(models.Model):
    """
    Quiz de múltipla escolha gerado pela LLM para um módulo específico.
    Suporta três níveis: subtópico isolado, tópico inteiro, módulo completo.
    A combinação (modulo, tipo, referencia) é única — evita regeneração duplicada.

    Estrutura de 'questoes':
    [
      {
        "enunciado": "...",
        "alternativas": {"A": "...", "B": "...", "C": "...", "D": "..."},
        "gabarito": "A",
        "explicacao": "...",
        "dificuldade": "facil"|"medio"|"dificil",
        "nivel": "subtopico"|"topico"|"modulo"
      }
    ]
    """

    class Tipo(models.TextChoices):
        SUBTOPICO = "subtopico", "Subtópico"
        TOPICO = "topico", "Tópico"
        MODULO = "modulo", "Módulo"

    modulo = models.ForeignKey(
        "Modulo",
        on_delete=models.CASCADE,
        related_name="quizzes",
    )
    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices,
        default=Tipo.MODULO,
        help_text="Nível do quiz: subtópico isolado, tópico inteiro ou módulo completo.",
    )
    referencia = models.CharField(
        max_length=300,
        blank=True,
        default="",
        help_text="Nome do subtópico ou tópico avaliado. Vazio para quiz de módulo.",
    )
    questoes = models.JSONField(default=list)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("modulo", "tipo", "referencia")
        verbose_name = "quiz gerado"
        verbose_name_plural = "quizzes gerados"

    def __str__(self):
        ref = f" › {self.referencia}" if self.referencia else ""
        return f"Quiz [{self.tipo}]{ref} — {self.modulo}"


class QuizTentativa(models.Model):
    """
    Registro de cada tentativa de quiz feita por um usuário.
    Transitivamente herda o tipo/referencia do QuizGerado associado.
    """
    quiz = models.ForeignKey(QuizGerado, on_delete=models.CASCADE, related_name="tentativas")
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="quiz_tentativas",
    )
    acertos = models.PositiveSmallIntegerField()
    total = models.PositiveSmallIntegerField()
    respostas = models.JSONField(default=dict, help_text='{"0": "A", "1": "C", ...}')
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "tentativa de quiz"
        verbose_name_plural = "tentativas de quiz"

    def __str__(self):
        return f"{self.usuario.email} — {self.quiz} — {self.acertos}/{self.total} ({'★' * self.estrelas})"

    @property
    def estrelas(self) -> int:
        """Converte acertos em estrelas (0–5). 1 acerto = 1 estrela."""
        return self.acertos


class Proficiencia(models.Model):
    """
    Melhor score do usuário por nível de granularidade (subtópico / tópico / módulo).
    Atualizado a cada tentativa de quiz, mantendo apenas o melhor resultado.
    Serve como painel de diagnóstico de fragilidades por objeto do conhecimento.
    """

    class Nivel(models.TextChoices):
        SUBTOPICO = "subtopico", "Subtópico"
        TOPICO = "topico", "Tópico"
        MODULO = "modulo", "Módulo"

    modulo = models.ForeignKey(
        "Modulo",
        on_delete=models.CASCADE,
        related_name="proficiencias",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="proficiencias",
    )
    nivel = models.CharField(max_length=20, choices=Nivel.choices)
    referencia = models.CharField(
        max_length=300,
        blank=True,
        default="",
        help_text="Nome do subtópico ou tópico. Vazio para nível módulo.",
    )
    melhor_acertos = models.PositiveSmallIntegerField(default=0)
    total_questoes = models.PositiveSmallIntegerField(
        default=0,
        help_text="Total de questões do quiz que gerou o melhor score.",
    )
    total_tentativas = models.PositiveSmallIntegerField(default=0)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("modulo", "usuario", "nivel", "referencia")
        ordering = ["nivel", "referencia"]
        verbose_name = "proficiência"
        verbose_name_plural = "proficiências"

    def __str__(self):
        ref = f" › {self.referencia}" if self.referencia else ""
        return f"{self.usuario.email} [{self.nivel}]{ref} — {self.melhor_acertos}/{self.total_questoes}"

    @property
    def melhor_score(self) -> float:
        """Score 0.0–1.0 (acertos/total)."""
        return self.melhor_acertos / self.total_questoes if self.total_questoes > 0 else 0.0

    @property
    def dominado(self) -> bool:
        """Considera dominado quando acerta ≥ 80% das questões."""
        return self.melhor_score >= 0.8


class LacunaConceitual(models.Model):
    """
    Conceito identificado como frágil a partir de uma resposta errada no quiz.
    Gerado pela LLM analisando o erro do usuário — 1 lacuna por questão errada.
    """
    tentativa = models.ForeignKey(
        QuizTentativa,
        on_delete=models.CASCADE,
        related_name="lacunas",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lacunas",
    )
    numero_questao = models.PositiveSmallIntegerField(
        help_text="Índice (0-based) da questão errada na tentativa."
    )
    subtopico_ref = models.CharField(
        max_length=300,
        help_text="Subtópico ao qual o conceito pertence.",
    )
    conceito = models.CharField(
        max_length=300,
        help_text="Nome curto do conceito mal compreendido.",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("tentativa", "numero_questao")
        ordering = ["subtopico_ref", "conceito"]
        verbose_name = "lacuna conceitual"
        verbose_name_plural = "lacunas conceituais"

    def __str__(self):
        return f"{self.usuario.email} — {self.conceito} ({self.subtopico_ref})"


class Flashcard(models.Model):
    """
    Flashcard de fixação gerado para uma LacunaConceitual.
    Considera o conceito dominado após ACERTOS_PARA_DOMINIO acertos consecutivos.
    Resetar ao errar força repetição espaçada.
    """
    ACERTOS_PARA_DOMINIO = 2

    lacuna = models.OneToOneField(
        LacunaConceitual,
        on_delete=models.CASCADE,
        related_name="flashcard",
    )
    frente = models.TextField(help_text="Pergunta ou estímulo do flashcard.")
    verso = models.TextField(help_text="Resposta ou explicação do flashcard.")
    acertos_consecutivos = models.PositiveSmallIntegerField(default=0)
    ultima_resposta_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "flashcard"
        verbose_name_plural = "flashcards"

    def __str__(self):
        status = "✓" if self.dominado else f"{self.acertos_consecutivos}/{self.ACERTOS_PARA_DOMINIO}"
        return f"[{status}] {self.lacuna.conceito}"

    @property
    def dominado(self) -> bool:
        return self.acertos_consecutivos >= self.ACERTOS_PARA_DOMINIO


class Modulo(models.Model):

    class Status(models.TextChoices):
        NAO_INICIADO = "nao_iniciado", "Não iniciado"
        EM_ANDAMENTO = "em_andamento", "Em andamento"
        CONCLUIDO = "concluido", "Concluído"

    trilha = models.ForeignKey(Trilha, on_delete=models.CASCADE, related_name="modulos")
    nome = models.CharField(max_length=200)
    ordem = models.PositiveIntegerField()
    peso = models.FloatField(
        help_text="Proporção histórica de questões (soma dos pesos da trilha = 1.0)"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NAO_INICIADO,
    )
    progresso = models.FloatField(default=0.0, help_text="Percentual de 0 a 100")
    topicos = models.JSONField(
        default=list,
        help_text="Lista de tópicos do edital para este módulo",
    )

    class Meta:
        ordering = ["ordem"]
        verbose_name = "módulo"
        verbose_name_plural = "módulos"

    def __str__(self):
        return f"{self.ordem}. {self.nome}"
