# TODO FASE 2: campo 'areas_conhecimento' JSONField para matching automático
import uuid

from django.conf import settings
from django.db import models


class Banca(models.Model):
    nome = models.CharField(max_length=200)
    sigla = models.CharField(max_length=30, unique=True)
    site = models.URLField(blank=True)

    class Meta:
        verbose_name = "banca"
        verbose_name_plural = "bancas"
        ordering = ["sigla"]

    def __str__(self):
        return self.sigla


class Concurso(models.Model):
    class Area(models.TextChoices):
        FEDERAL = "federal", "Federal"
        ESTADUAL = "estadual", "Estadual"
        MUNICIPAL = "municipal", "Municipal"
        MILITAR = "militar", "Militar"

    class Status(models.TextChoices):
        PREVISTO = "previsto", "Previsto"
        ABERTO = "aberto", "Aberto"
        ENCERRADO = "encerrado", "Encerrado"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    orgao = models.CharField("órgão", max_length=200)
    cargo = models.CharField(max_length=200)
    area = models.CharField(max_length=20, choices=Area.choices)
    banca = models.ForeignKey(
        Banca,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="concursos",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PREVISTO)
    vagas = models.PositiveIntegerField(null=True, blank=True)
    salario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    inscricao_ini = models.DateField("início das inscrições", null=True, blank=True)
    inscricao_fim = models.DateField("fim das inscrições", null=True, blank=True)
    edital_url = models.URLField("URL do edital", blank=True)
    # NÃO exposto na API de listagem — alimenta a LLM
    edital_texto = models.TextField(
        "texto do edital",
        blank=True,
        help_text="Cole aqui o texto extraído do edital. Este campo alimenta a IA para gerar trilhas.",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "concurso"
        verbose_name_plural = "concursos"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.orgao} — {self.cargo}"


class ConcursoSalvo(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="concursos_salvos",
    )
    concurso = models.ForeignKey(
        Concurso,
        on_delete=models.CASCADE,
        related_name="salvos_por",
    )
    salvo_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("usuario", "concurso")
        verbose_name = "concurso salvo"
        verbose_name_plural = "concursos salvos"

    def __str__(self):
        return f"{self.usuario.email} → {self.concurso}"
