# TODO FASE 2: adicionar campos de preferências para matching candidato × edital
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Plano(models.TextChoices):
        GRATUITO = "gratuito", "Gratuito"
        CANDIDATO = "candidato", "Candidato"
        ANUAL = "anual", "Anual"

    email = models.EmailField(unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    plano = models.CharField(
        max_length=20,
        choices=Plano.choices,
        default=Plano.GRATUITO,
    )
    creditos_llm = models.PositiveIntegerField(default=30)
    editais_monitorados = models.PositiveIntegerField(default=3)

    class Meta:
        verbose_name = "usuário"
        verbose_name_plural = "usuários"

    def __str__(self):
        return self.email

    @property
    def tem_credito_llm(self) -> bool:
        """Retorna True se o usuário tem crédito para usar a LLM."""
        return self.plano != self.Plano.GRATUITO or self.creditos_llm > 0

    def debitar_credito(self) -> None:
        """Decrementa crédito apenas no plano gratuito."""
        if self.plano == self.Plano.GRATUITO and self.creditos_llm > 0:
            self.creditos_llm -= 1
            self.save(update_fields=["creditos_llm"])
