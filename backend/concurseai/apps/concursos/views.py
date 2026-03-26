# TODO FASE 2: ConcursoCompatibilidadeView — análise LLM de compatibilidade candidato × edital
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions

from .models import Concurso, ConcursoSalvo
from .serializers import ConcursoDetailSerializer, ConcursoListSerializer, ConcursoSalvoSerializer


class ConcursoFilter:
    """Filtros disponíveis: status, area, banca."""
    pass


class ConcursoListView(generics.ListAPIView):
    """GET /api/concursos/ — público, filtros via django-filter."""

    queryset = Concurso.objects.select_related("banca").all()
    serializer_class = ConcursoListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "area", "banca"]
    search_fields = ["orgao", "cargo"]


class ConcursoDetailView(generics.RetrieveAPIView):
    """GET /api/concursos/<uuid>/ — público."""

    queryset = Concurso.objects.select_related("banca").all()
    serializer_class = ConcursoDetailSerializer
    permission_classes = [permissions.AllowAny]


class ConcursoSalvoListView(generics.ListCreateAPIView):
    """GET|POST /api/concursos/salvos/ — autenticado."""

    serializer_class = ConcursoSalvoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ConcursoSalvo.objects.filter(usuario=self.request.user).select_related("concurso__banca")


class ConcursoSalvoDeleteView(generics.DestroyAPIView):
    """DELETE /api/concursos/salvos/<id>/ — autenticado."""

    serializer_class = ConcursoSalvoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ConcursoSalvo.objects.filter(usuario=self.request.user)
