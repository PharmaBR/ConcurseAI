# TODO FASE 2: TrilhaQuizView — geração de quiz por módulo via LLM
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Modulo, Trilha
from .serializers import AvancarModuloSerializer, ModuloSerializer, TrilhaSerializer


class TrilhaListView(generics.ListAPIView):
    """GET /api/trilhas/ — trilhas do usuário logado."""

    serializer_class = TrilhaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Trilha.objects.filter(usuario=self.request.user)
            .select_related("concurso")
            .prefetch_related(
                "modulos",
                "modulos__quizzes",
                "modulos__quizzes__tentativas",
                "modulos__proficiencias",
            )
        )


class TrilhaDetailView(generics.RetrieveAPIView):
    """GET /api/trilhas/<uuid>/ — detalhe de uma trilha."""

    serializer_class = TrilhaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Trilha.objects.filter(usuario=self.request.user)
            .prefetch_related(
                "modulos",
                "modulos__quizzes",
                "modulos__quizzes__tentativas",
                "modulos__proficiencias",
            )
        )


@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated])
def avancar_modulo_view(request, pk):
    """PATCH /api/trilhas/modulos/<id>/avancar/ body: {"progresso": 75.0}"""
    modulo = get_object_or_404(Modulo, pk=pk, trilha__usuario=request.user)
    serializer = AvancarModuloSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    novo_progresso = serializer.validated_data["progresso"]
    modulo.progresso = novo_progresso

    if novo_progresso >= 100.0:
        modulo.status = Modulo.Status.CONCLUIDO
    elif novo_progresso > 0.0:
        modulo.status = Modulo.Status.EM_ANDAMENTO
    else:
        modulo.status = Modulo.Status.NAO_INICIADO

    modulo.save(update_fields=["progresso", "status"])
    return Response(ModuloSerializer(modulo).data, status=status.HTTP_200_OK)
