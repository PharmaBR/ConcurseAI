from rest_framework import serializers

from .models import Banca, Concurso, ConcursoSalvo


class BancaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banca
        fields = ("id", "nome", "sigla", "site")


class ConcursoListSerializer(serializers.ModelSerializer):
    """Serializer para listagem — NÃO inclui edital_texto."""

    banca = BancaSerializer(read_only=True)

    class Meta:
        model = Concurso
        fields = (
            "id",
            "orgao",
            "cargo",
            "area",
            "banca",
            "status",
            "vagas",
            "salario",
            "inscricao_ini",
            "inscricao_fim",
            "edital_url",
            "criado_em",
        )


class ConcursoDetailSerializer(ConcursoListSerializer):
    """Serializer para detalhe — também NÃO expõe edital_texto."""

    class Meta(ConcursoListSerializer.Meta):
        fields = ConcursoListSerializer.Meta.fields + ("atualizado_em",)


class ConcursoSalvoSerializer(serializers.ModelSerializer):
    concurso = ConcursoListSerializer(read_only=True)
    concurso_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = ConcursoSalvo
        fields = ("id", "concurso", "concurso_id", "salvo_em")
        read_only_fields = ("id", "salvo_em")

    def create(self, validated_data):
        validated_data["usuario"] = self.context["request"].user
        return super().create(validated_data)
