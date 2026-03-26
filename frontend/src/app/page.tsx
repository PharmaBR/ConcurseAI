"use client";

import { useState } from "react";
import { ConcursoList } from "@/components/concursos/ConcursoList";
import { useConcursos } from "@/hooks/useConcursos";

// TODO FASE 3: substituir cards estáticos por <C1Component> da Thesys

export default function Home() {
  const { concursos, salvos, loading, erro, buscar, salvar, removerSalvo } = useConcursos();
  const [statusFiltro, setStatusFiltro] = useState("");
  const [areaFiltro, setAreaFiltro] = useState("");

  const salvosIds = new Set(salvos.map((s) => s.concurso.id));

  function handleFiltrar() {
    buscar({
      status: statusFiltro || undefined,
      area: areaFiltro || undefined,
    });
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">ConcurseAI</h1>
      <p className="text-gray-500 mb-6">Prepare-se para concursos públicos com inteligência artificial.</p>

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="previsto">Previsto</option>
          <option value="aberto">Aberto</option>
          <option value="encerrado">Encerrado</option>
        </select>

        <select
          value={areaFiltro}
          onChange={(e) => setAreaFiltro(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">Todas as áreas</option>
          <option value="federal">Federal</option>
          <option value="estadual">Estadual</option>
          <option value="municipal">Municipal</option>
          <option value="militar">Militar</option>
        </select>

        <button
          onClick={handleFiltrar}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Filtrar
        </button>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          Erro ao carregar concursos: <strong>{erro}</strong>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Carregando concursos...</p>
      ) : (
        <ConcursoList
          concursos={concursos}
          salvosIds={salvosIds}
          salvos={salvos}
          onSalvar={salvar}
          onRemoverSalvo={removerSalvo}
        />
      )}
    </main>
  );
}
