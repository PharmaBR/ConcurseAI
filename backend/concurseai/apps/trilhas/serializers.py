from rest_framework import serializers

from .models import Modulo, Proficiencia, Trilha


class ModuloSerializer(serializers.ModelSerializer):
    quiz_estrelas = serializers.SerializerMethodField()
    proficiencia = serializers.SerializerMethodField()

    class Meta:
        model = Modulo
        fields = (
            "id", "nome", "ordem", "peso", "status", "progresso", "topicos",
            "quiz_estrelas", "proficiencia",
        )
        read_only_fields = ("id",)

    def get_quiz_estrelas(self, obj) -> int | None:
        """Melhor score (estrelas 0–5) no quiz de módulo completo. Usa prefetch de proficiencias."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        try:
            # Usa proficiencias prefetchadas (evita N+1) para o nível módulo
            for p in obj.proficiencias.all():
                if p.nivel == Proficiencia.Nivel.MODULO and p.usuario_id == request.user.id:
                    return p.melhor_acertos
            return None
        except Exception:
            return None

    def get_proficiencia(self, obj) -> dict:
        """
        Retorna o diagnóstico de proficiência do usuário em todos os níveis deste módulo.
        Estrutura:
        {
          "modulo": {"melhor_acertos": int, "total": int, "score": float, "dominado": bool} | null,
          "topicos": {"<nome_topico>": {...}} ,
          "subtopicos": {"<nome_subtopico>": {...}}
        }
        """
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return {"modulo": None, "topicos": {}, "subtopicos": {}}

        result: dict = {"modulo": None, "topicos": {}, "subtopicos": {}}
        try:
            for p in obj.proficiencias.all():
                if p.usuario_id != request.user.id:
                    continue
                entry = {
                    "melhor_acertos": p.melhor_acertos,
                    "total": p.total_questoes,
                    "score": round(p.melhor_score, 2),
                    "dominado": p.dominado,
                    "tentativas": p.total_tentativas,
                }
                if p.nivel == Proficiencia.Nivel.MODULO:
                    result["modulo"] = entry
                elif p.nivel == Proficiencia.Nivel.TOPICO:
                    result["topicos"][p.referencia] = entry
                elif p.nivel == Proficiencia.Nivel.SUBTOPICO:
                    result["subtopicos"][p.referencia] = entry
        except Exception:
            pass
        return result


class TrilhaSerializer(serializers.ModelSerializer):
    modulos = ModuloSerializer(many=True, read_only=True)
    progresso = serializers.FloatField(read_only=True)

    class Meta:
        model = Trilha
        fields = ("id", "concurso", "modulos", "progresso", "criado_em", "atualizado_em")
        read_only_fields = ("id", "criado_em", "atualizado_em")


class AvancarModuloSerializer(serializers.Serializer):
    progresso = serializers.FloatField(min_value=0.0, max_value=100.0)
