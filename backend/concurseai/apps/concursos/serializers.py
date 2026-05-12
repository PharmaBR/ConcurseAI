from rest_framework import serializers

from .models import Banca, Concurso, ConcursoSalvo


class BancaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banca
        fields = ("id", "nome", "sigla", "site")


class ConcursoListSerializer(serializers.ModelSerializer):
    """Serializer para listagem — NÃO inclui edital_texto."""

    banca = BancaSerializer(read_only=True)
    # True se o campo edital_texto foi preenchido (permite gerar trilha)
    tem_edital = serializers.SerializerMethodField()
    # True se foi criado pelo usuário autenticado na requisição atual
    is_proprio = serializers.SerializerMethodField()

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
            "tem_edital",
            "is_proprio",
        )

    def get_tem_edital(self, obj: Concurso) -> bool:
        return bool(obj.edital_texto and obj.edital_texto.strip())

    def get_is_proprio(self, obj: Concurso) -> bool:
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return obj.criado_por_id == request.user.pk


class ConcursoDetailSerializer(ConcursoListSerializer):
    """Serializer para detalhe — também NÃO expõe edital_texto."""

    class Meta(ConcursoListSerializer.Meta):
        fields = ConcursoListSerializer.Meta.fields + ("atualizado_em",)


class ConcursoCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para criação de concurso pelo próprio usuário.
    Aceita edital_texto (obrigatório) e banca_nome (opcional — lookup por sigla/nome).
    Retorna os mesmos campos de ConcursoListSerializer após criação.
    """

    banca_nome = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        max_length=100,
        help_text="Sigla ou nome da banca. Se não existir, será criada automaticamente.",
    )
    # Leitura: exibe o objeto banca já resolvido
    banca = BancaSerializer(read_only=True)
    tem_edital = serializers.SerializerMethodField()
    is_proprio = serializers.SerializerMethodField()

    class Meta:
        model = Concurso
        fields = (
            "id",
            "orgao",
            "cargo",
            "area",
            "banca",
            "banca_nome",
            "status",
            "vagas",
            "salario",
            "inscricao_ini",
            "inscricao_fim",
            "edital_url",
            "edital_texto",
            "criado_em",
            "tem_edital",
            "is_proprio",
        )
        read_only_fields = ("id", "criado_em", "banca")
        extra_kwargs = {
            "edital_texto": {"required": True},
            "status": {"default": Concurso.Status.PREVISTO},
        }

    def get_tem_edital(self, obj: Concurso) -> bool:
        return bool(obj.edital_texto and obj.edital_texto.strip())

    def get_is_proprio(self, obj: Concurso) -> bool:
        return True  # se chegou aqui, foi criado por quem está pedindo

    def validate_edital_texto(self, value: str) -> str:
        if not value or not value.strip():
            raise serializers.ValidationError("O texto do edital não pode estar vazio.")
        if len(value.strip()) < 100:
            raise serializers.ValidationError(
                "O texto do edital parece muito curto. Cole o conteúdo completo do edital."
            )
        return value.strip()

    def create(self, validated_data: dict) -> Concurso:
        banca_nome = validated_data.pop("banca_nome", "").strip()
        banca = None

        if banca_nome:
            # Tenta encontrar pela sigla (case-insensitive), depois pelo nome
            banca = (
                Banca.objects.filter(sigla__iexact=banca_nome).first()
                or Banca.objects.filter(nome__iexact=banca_nome).first()
            )
            if not banca:
                # Cria uma nova banca com sigla = nome fornecido (máx 30 chars)
                sigla = banca_nome[:30].upper()
                banca = Banca.objects.create(nome=banca_nome, sigla=sigla)

        validated_data["banca"] = banca
        return super().create(validated_data)


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
