"use client";

// TODO FASE 3: substituir módulos estáticos por <C1Component> da Thesys

import { ModuloCard } from "./ModuloCard";

interface Modulo {
  id: number;
  nome: string;
  ordem: number;
  peso: number;
  status: "nao_iniciado" | "em_andamento" | "concluido";
  progresso: number;
  topicos: string[];
  proficiencia?: { modulo: unknown; topicos: Record<string, unknown>; subtopicos: Record<string, unknown> } | null;
  flashcards_pendentes?: number;
}

interface ConcursoResumo {
  id: string;
  orgao: string;
  cargo: string;
  banca_sigla: string;
  status: string;
}

interface Trilha {
  id: string;
  concurso: ConcursoResumo | string;
  modulos: Modulo[];
  progresso: number;
}

interface Props {
  trilha: Trilha;
  onAvancar: (moduloId: number, progresso: number) => Promise<void>;
}

/** Calcula o estado geral de estudo para decidir qual hint exibir. */
function calcularEstado(modulos: Modulo[]): "virgem" | "flashcards_pendentes" | "em_andamento" | "dominado" {
  const totalFlashcards = modulos.reduce((acc, m) => acc + (m.flashcards_pendentes ?? 0), 0);
  if (totalFlashcards > 0) return "flashcards_pendentes";

  const algumComProf = modulos.some(
    (m) =>
      m.proficiencia?.modulo ||
      Object.keys(m.proficiencia?.topicos ?? {}).length > 0 ||
      Object.keys(m.proficiencia?.subtopicos ?? {}).length > 0
  );
  if (!algumComProf) return "virgem";

  const todosDominados = modulos.every((m) => m.status === "concluido");
  if (todosDominados) return "dominado";

  return "em_andamento";
}

/** Banner contextual de próximo passo — some quando o usuário já sabe o que fazer. */
function ProximoPasso({ modulos }: { modulos: Modulo[] }) {
  const estado = calcularEstado(modulos);
  const totalFlashcards = modulos.reduce((acc, m) => acc + (m.flashcards_pendentes ?? 0), 0);

  if (estado === "virgem") {
    return (
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6">
        <span className="text-xl shrink-0">💡</span>
        <div>
          <p className="text-sm font-semibold text-blue-800">Por onde começar?</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Escolha qualquer módulo e use os botões coloridos:{" "}
            <strong>Quiz</strong> para testar seu nível,{" "}
            <strong>Chat IA</strong> para tirar dúvidas e{" "}
            <strong>Flashcards</strong> para fixar o que errou.
          </p>
        </div>
      </div>
    );
  }

  if (estado === "flashcards_pendentes") {
    return (
      <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-6">
        <span className="text-xl shrink-0">📚</span>
        <div>
          <p className="text-sm font-semibold text-orange-800">Revisão pendente</p>
          <p className="text-sm text-orange-700 mt-0.5">
            Você tem <strong>{totalFlashcards} flashcard{totalFlashcards !== 1 ? "s" : ""}</strong> para revisar.
            Clique em <strong>Flashcards</strong> em qualquer módulo para fixar os conceitos que errou.
          </p>
        </div>
      </div>
    );
  }

  if (estado === "dominado") {
    return (
      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
        <span className="text-xl shrink-0">🎉</span>
        <div>
          <p className="text-sm font-semibold text-green-800">Trilha concluída!</p>
          <p className="text-sm text-green-700 mt-0.5">
            Você marcou todos os módulos como concluídos. Continue reforçando com quizzes ou explore outros concursos.
          </p>
        </div>
      </div>
    );
  }

  // em_andamento — não exibe hint, usuário já entende o fluxo
  return null;
}

export function TrilhaView({ trilha, onAvancar }: Props) {
  const totalModulos = trilha.modulos.length;
  const concluidos = trilha.modulos.filter((m) => m.status === "concluido").length;

  // Suporte a concurso como objeto aninhado (novo) ou UUID (legado)
  const concurso = typeof trilha.concurso === "object" ? trilha.concurso : null;

  return (
    <div>
      {/* Cabeçalho com contexto do concurso */}
      <div className="mb-6">
        {concurso ? (
          <>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{concurso.orgao}</h1>
              {concurso.banca_sigla && (
                <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {concurso.banca_sigla}
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm">{concurso.cargo}</p>
          </>
        ) : (
          <h1 className="text-2xl font-bold">Sua Trilha de Estudos</h1>
        )}

        <p className="text-gray-400 text-sm mt-1">
          {concluidos} de {totalModulos} módulos concluídos
        </p>

        {/* Barra de progresso geral */}
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

      {/* Banner de próximo passo */}
      <ProximoPasso modulos={trilha.modulos} />

      {/* Lista de módulos */}
      <div className="flex flex-col gap-4">
        {trilha.modulos.map((modulo) => (
          <ModuloCard key={modulo.id} modulo={modulo} onAvancar={onAvancar} />
        ))}
      </div>
    </div>
  );
}
