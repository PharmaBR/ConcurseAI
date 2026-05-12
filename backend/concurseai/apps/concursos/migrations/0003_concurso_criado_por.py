from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("concursos", "0002_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="concurso",
            name="criado_por",
            field=models.ForeignKey(
                blank=True,
                help_text="Preenchido quando o concurso foi criado diretamente pelo usuário.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="concursos_criados",
                to=settings.AUTH_USER_MODEL,
                verbose_name="criado por",
            ),
        ),
    ]
