# TODO FASE 2: ConcursoCompatibilidadeView — análise LLM de compatibilidade candidato × edital
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from .models import Concurso, ConcursoSalvo
from .serializers import (
    ConcursoCreateSerializer,
    ConcursoDetailSerializer,
    ConcursoListSerializer,
    ConcursoSalvoSerializer,
)


class ConcursoListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/concursos/ — público; retorna concursos admin + os do usuário logado.
    POST /api/concursos/ — autenticado; cria concurso pessoal com edital colado.
    """

    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "area", "banca"]
    search_fields = ["orgao", "cargo"]

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        # Concursos admin (criado_por=None) — visíveis para todos
        qs = Concurso.objects.select_related("banca").filter(criado_por__isnull=True)

        # Se autenticado, inclui também os concursos criados pelo próprio usuário
        if self.request.user and self.request.user.is_authenticated:
            qs = Concurso.objects.select_related("banca").filter(
                Q(criado_por__isnull=True) | Q(criado_por=self.request.user)
            )

        return qs.order_by("-criado_em")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ConcursoCreateSerializer
        return ConcursoListSerializer

    def perform_create(self, serializer):
        serializer.save(criado_por=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Retorna com o serializer de leitura para incluir banca resolvida, tem_edital etc.
        read_serializer = ConcursoListSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)


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
