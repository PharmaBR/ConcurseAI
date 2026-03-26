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


class Modulo(models.Model):
    # TODO FASE 2: FK para QuizGerado — quando app quiz for implementado

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
