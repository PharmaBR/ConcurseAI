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
    Cada módulo pode ter no máximo um quiz (unique on modulo).
    Estrutura de 'questoes':
    [
      {
        "enunciado": "...",
        "alternativas": {"A": "...", "B": "...", "C": "...", "D": "..."},
        "gabarito": "A",
        "explicacao": "..."
      }
    ]
    """
    modulo = models.OneToOneField(
        "Modulo",
        on_delete=models.CASCADE,
        related_name="quiz",
    )
    questoes = models.JSONField(default=list)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "quiz gerado"
        verbose_name_plural = "quizzes gerados"

    def __str__(self):
        return f"Quiz — {self.modulo}"


class QuizTentativa(models.Model):
    """
    Registro de cada tentativa de quiz feita por um usuário.
    Permite calcular o melhor score (estrelas) para validar o conhecimento declarado.
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
        """Converte acertos em estrelas (0–5)."""
        return self.acertos  # 1 acerto = 1 estrela, máximo 5


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
