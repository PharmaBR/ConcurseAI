"use client";

// TODO FASE 2: useLLMStream.ts — chat streaming
// TODO FASE 3: useThesysC1.ts — Generative UI

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Banca {
  id: number;
  nome: string;
  sigla: string;
  site: string;
}

export interface Concurso {
  id: string;
  orgao: string;
  cargo: string;
  area: "federal" | "estadual" | "municipal" | "militar";
  banca: Banca | null;
  status: "previsto" | "aberto" | "encerrado";
  vagas: number | null;
  salario: string | null;
  inscricao_ini: string | null;
  inscricao_fim: string | null;
  edital_url: string;
  criado_em: string;
}

export interface ConcursoSalvo {
  id: number;
  concurso: Concurso;
  salvo_em: string;
}

interface Filtros {
  status?: string;
  area?: string;
  banca?: number;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function useConcursos() {
  const [concursos, setConcursos] = useState<Concurso[]>([]);
  const [salvos, setSalvos] = useState<ConcursoSalvo[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar(filtros?: Filtros): Promise<void> {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (filtros?.status) params.set("status", filtros.status);
      if (filtros?.area) params.set("area", filtros.area);
      if (filtros?.banca) params.set("banca", String(filtros.banca));

      const res = await fetch(`${API_URL}/api/concursos/?${params.toString()}`);
      if (!res.ok) throw new Error(`API retornou ${res.status}`);
      const data = await res.json();
      setConcursos(data.results ?? data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar concursos.");
      setConcursos([]);
    } finally {
      setLoading(false);
    }
  }

  async function buscarSalvos(): Promise<void> {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/api/concursos/salvos/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setSalvos(data.results ?? data);
    }
  }

  async function salvar(concursoId: string): Promise<void> {
    const token = getToken();
    if (!token) throw new Error("Usuário não autenticado.");
    const res = await fetch(`${API_URL}/api/concursos/salvos/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ concurso_id: concursoId }),
    });
    if (res.ok) {
      await buscarSalvos();
    }
  }

  async function removerSalvo(id: number): Promise<void> {
    const token = getToken();
    if (!token) throw new Error("Usuário não autenticado.");
    await fetch(`${API_URL}/api/concursos/salvos/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSalvos((prev) => prev.filter((s) => s.id !== id));
  }

  // Carrega na montagem
  useEffect(() => {
    buscar();
    buscarSalvos();
  }, []);

  return { concursos, salvos, loading, erro, buscar, salvar, removerSalvo };
}
