"use client";

import { Concurso, ConcursoSalvo } from "@/hooks/useConcursos";
import { ConcursoCard } from "./ConcursoCard";

interface Props {
  concursos: Concurso[];
  salvosIds: Set<string>;
  salvos: ConcursoSalvo[];
  trilhasMap: Record<string, string>;
  onSalvar: (id: string) => Promise<void>;
  onRemoverSalvo: (id: number) => Promise<void>;
}

export function ConcursoList({ concursos, salvosIds, salvos, trilhasMap, onSalvar, onRemoverSalvo }: Props) {
  if (concursos.length === 0) {
    return (
      <p className="text-gray-400 text-center py-12">
        Nenhum concurso encontrado para os filtros selecionados.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {concursos.map((concurso) => {
        const salvoEntry = salvos.find((s) => s.concurso.id === concurso.id);
        return (
          <ConcursoCard
            key={concurso.id}
            concurso={concurso}
            salvo={salvosIds.has(concurso.id)}
            savedId={salvoEntry?.id}
            trilhaId={trilhasMap[concurso.id]}
            onSalvar={onSalvar}
            onRemoverSalvo={onRemoverSalvo}
          />
        );
      })}
    </div>
  );
}
