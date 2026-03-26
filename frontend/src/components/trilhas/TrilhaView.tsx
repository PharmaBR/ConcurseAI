"use client";

// TODO FASE 3: substituir módulos estáticos por <C1Component> da Thesys
// TODO FASE 2: componente ChatExplicacao por módulo

import { ModuloCard } from "./ModuloCard";

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
}

interface Props {
  trilha: Trilha;
  onAvancar: (moduloId: number, progresso: number) => Promise<void>;
}

export function TrilhaView({ trilha, onAvancar }: Props) {
  const totalModulos = trilha.modulos.length;
  const concluidos = trilha.modulos.filter((m) => m.status === "concluido").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sua Trilha de Estudos</h1>
        <p className="text-gray-500 text-sm mt-1">
          {concluidos} de {totalModulos} módulos concluídos
        </p>

        {/* Progresso geral */}
        <div className="mt-3">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Progresso geral</span>
            <span>{trilha.progresso.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${trilha.progresso}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {trilha.modulos.map((modulo) => (
          <ModuloCard key={modulo.id} modulo={modulo} onAvancar={onAvancar} />
        ))}
      </div>
    </div>
  );
}
