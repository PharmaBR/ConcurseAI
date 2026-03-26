from rest_framework import serializers

from .models import Modulo, Trilha


class ModuloSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modulo
        fields = ("id", "nome", "ordem", "peso", "status", "progresso", "topicos")
        read_only_fields = ("id",)


class TrilhaSerializer(serializers.ModelSerializer):
    modulos = ModuloSerializer(many=True, read_only=True)
    progresso = serializers.FloatField(read_only=True)

    class Meta:
        model = Trilha
        fields = ("id", "concurso", "modulos", "progresso", "criado_em", "atualizado_em")
        read_only_fields = ("id", "criado_em", "atualizado_em")


class AvancarModuloSerializer(serializers.Serializer):
    progresso = serializers.FloatField(min_value=0.0, max_value=100.0)
