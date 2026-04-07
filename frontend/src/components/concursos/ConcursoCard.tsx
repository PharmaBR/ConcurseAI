"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Concurso } from "@/hooks/useConcursos";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_COLORS: Record<string, string> = {
  previsto: "bg-yellow-100 text-yellow-800",
  aberto: "bg-green-100 text-green-800",
  encerrado: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  previsto: "Previsto",
  aberto: "Aberto",
  encerrado: "Encerrado",
};

interface Props {
  concurso: Concurso;
  salvo: boolean;
  savedId?: number;
  onSalvar: (id: string) => Promise<void>;
  onRemoverSalvo: (id: number) => Promise<void>;
}

export function ConcursoCard({ concurso, salvo, savedId, onSalvar, onRemoverSalvo }: Props) {
  const router = useRouter();
  const [gerando, setGerando] = useState(false);
  const [segundos, setSegundos] = useState(0);

  async function handleToggleSalvo() {
    if (salvo && savedId !== undefined) {
      await onRemoverSalvo(savedId);
    } else {
      await onSalvar(concurso.id);
    }
  }

  async function handleGerarTrilha() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    setGerando(true);
    setSegundos(0);
    const intervalo = setInterval(() => setSegundos((s) => s + 1), 1000);

    try {
      const res = await fetch(`${API_URL}/api/llm/trilha/${concurso.id}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/trilha/${data.trilha_id}`);
      } else {
        const data = await res.json();
        alert(data.detail || "Erro ao gerar trilha.");
      }
    } finally {
      clearInterval(intervalo);
      setGerando(false);
      setSegundos(0);
    }
  }

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-lg leading-tight">{concurso.orgao}</h2>
          <p className="text-gray-600 text-sm">{concurso.cargo}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[concurso.status]}`}>
          {STATUS_LABELS[concurso.status]}
        </span>
      </div>

      <div className="flex gap-4 text-sm text-gray-500 flex-wrap">
        {concurso.banca && <span>Banca: <strong>{concurso.banca.sigla}</strong></span>}
        {concurso.vagas != null && <span>Vagas: <strong>{concurso.vagas}</strong></span>}
        {concurso.salario && (
          <span>
            Salário: <strong>R$ {Number(concurso.salario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
          </span>
        )}
      </div>

      {(concurso.inscricao_ini || concurso.inscricao_fim) && (
        <p className="text-xs text-gray-400">
          Inscrições:{" "}
          {concurso.inscricao_ini
            ? new Date(concurso.inscricao_ini).toLocaleDateString("pt-BR")
            : "—"}{" "}
          até{" "}
          {concurso.inscricao_fim
            ? new Date(concurso.inscricao_fim).toLocaleDateString("pt-BR")
            : "—"}
        </p>
      )}

      <div className="flex gap-2 mt-1">
        <button
          onClick={handleGerarTrilha}
          disabled={gerando}
          className={`flex-1 text-white text-sm py-1.5 rounded transition-colors ${
            gerando
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {gerando ? `Gerando trilha... ${segundos}s` : "Gerar trilha"}
        </button>
        <button
          onClick={handleToggleSalvo}
          className={`px-3 py-1.5 text-sm rounded border ${
            salvo
              ? "border-red-300 text-red-600 hover:bg-red-50"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {salvo ? "Remover" : "Salvar"}
        </button>
        {concurso.edital_url && (
          <a
            href={concurso.edital_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Edital
          </a>
        )}
      </div>
    </div>
  );
}
