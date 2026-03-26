from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "username", "plano", "creditos_llm", "date_joined", "is_active")
    list_filter = ("plano", "is_active", "is_staff")
    search_fields = ("email", "username")
    ordering = ("-date_joined",)

    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Plano & Créditos",
            {
                "fields": ("plano", "creditos_llm", "editais_monitorados"),
            },
        ),
    )
