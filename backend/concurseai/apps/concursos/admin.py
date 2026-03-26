from django.contrib import admin

from .models import Banca, Concurso, ConcursoSalvo


@admin.register(Banca)
class BancaAdmin(admin.ModelAdmin):
    list_display = ("sigla", "nome", "site")
    search_fields = ("sigla", "nome")


@admin.register(Concurso)
class ConcursoAdmin(admin.ModelAdmin):
    list_display = ("orgao", "cargo", "banca", "area", "status", "vagas", "inscricao_fim")
    list_filter = ("status", "area", "banca")
    search_fields = ("orgao", "cargo")
    date_hierarchy = "inscricao_ini"

    fieldsets = (
        (
            "Identificação",
            {
                "fields": ("orgao", "cargo", "area", "banca", "status"),
            },
        ),
        (
            "Detalhes",
            {
                "fields": ("vagas", "salario", "inscricao_ini", "inscricao_fim", "edital_url"),
            },
        ),
        (
            "Conteúdo do Edital",
            {
                "classes": ("collapse",),
                "description": "Cole aqui o texto extraído do edital. Este campo alimenta a IA para gerar trilhas.",
                "fields": ("edital_texto",),
            },
        ),
    )


@admin.register(ConcursoSalvo)
class ConcursoSalvoAdmin(admin.ModelAdmin):
    list_display = ("usuario", "concurso", "salvo_em")
    list_filter = ("salvo_em",)
    raw_id_fields = ("usuario", "concurso")
