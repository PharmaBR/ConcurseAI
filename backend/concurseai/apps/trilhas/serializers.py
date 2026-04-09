from rest_framework import serializers

from .models import Modulo, Trilha


class ModuloSerializer(serializers.ModelSerializer):
    quiz_estrelas = serializers.SerializerMethodField()

    class Meta:
        model = Modulo
        fields = ("id", "nome", "ordem", "peso", "status", "progresso", "topicos", "quiz_estrelas")
        read_only_fields = ("id",)

    def get_quiz_estrelas(self, obj) -> int | None:
        """Retorna o melhor score (estrelas 0–5) do usuário logado neste módulo, ou None."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        try:
            quiz = obj.quiz  # OneToOne — usa prefetch se disponível
            best = (
                quiz.tentativas
                .filter(usuario=request.user)
                .order_by("-acertos")
                .first()
            )
            return best.estrelas if best else None
        except Exception:
            return None


class TrilhaSerializer(serializers.ModelSerializer):
    modulos = ModuloSerializer(many=True, read_only=True)
    progresso = serializers.FloatField(read_only=True)

    class Meta:
        model = Trilha
        fields = ("id", "concurso", "modulos", "progresso", "criado_em", "atualizado_em")
        read_only_fields = ("id", "criado_em", "atualizado_em")


class AvancarModuloSerializer(serializers.Serializer):
    progresso = serializers.FloatField(min_value=0.0, max_value=100.0)
