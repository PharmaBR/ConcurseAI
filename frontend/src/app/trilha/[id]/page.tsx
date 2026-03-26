"use client";

// TODO FASE 2: botão "Perguntar sobre este módulo" abre chat streaming
// TODO FASE 3: substituir módulos estáticos por <C1Component> da Thesys

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TrilhaView } from "@/components/trilhas/TrilhaView";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Modulo {
  id: number;
  nome: string;
  ordem: number;
  peso: number;
  status: "nao_iniciado" | "em_andamento" | "concluido";
  progresso: number;
  topicos: string[];
}

interface Trilha {
  id: string;
  concurso: string;
  modulos: Modulo[];
  progresso: number;
  criado_em: string;
}

export default function TrilhaPage() {
  const { id } = useParams<{ id: string }>();
  const [trilha, setTrilha] = useState<Trilha | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setErro("Faça login para ver sua trilha.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/trilhas/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setErro("Trilha não encontrada.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setTrilha(data);
      setLoading(false);
    }

    carregar();
  }, [id]);

  async function avancarModulo(moduloId: number, novoProgresso: number) {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${API_URL}/api/trilhas/modulos/${moduloId}/avancar/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ progresso: novoProgresso }),
    });

    if (res.ok) {
      const moduloAtualizado = await res.json();
      setTrilha((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          modulos: prev.modulos.map((m) =>
            m.id === moduloId ? { ...m, ...moduloAtualizado } : m
          ),
        };
      });
    }
  }

  if (loading) return <p className="p-8 text-gray-400">Carregando trilha...</p>;
  if (erro) return <p className="p-8 text-red-500">{erro}</p>;
  if (!trilha) return null;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <a href="/" className="text-blue-600 text-sm hover:underline mb-4 inline-block">
        ← Voltar
      </a>
      <TrilhaView trilha={trilha} onAvancar={avancarModulo} />
    </main>
  );
}
