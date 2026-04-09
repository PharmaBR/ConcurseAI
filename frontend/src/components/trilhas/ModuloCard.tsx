"use client";

// TODO FASE 3: ModuloCard usa GenerativeUI para feedback em tempo real

import { useState } from "react";
import { ChatExplicacao } from "./ChatExplicacao";
import { FlashcardDeck } from "./FlashcardDeck";
import { QuizModal } from "./QuizModal";

interface TopicoAninhado {
  nome: string;
  subtopicos: string[];
}

interface ProficienciaEntry {
  melhor_acertos: number;
  total: number;
  score: number;
  dominado: boolean;
  tentativas: number;
}

interface Proficiencia {
  modulo: ProficienciaEntry | null;
  topicos: Record<string, ProficienciaEntry>;
  subtopicos: Record<string, ProficienciaEntry>;
}

interface Modulo {
  id: number;
  nome: string;
  ordem: number;
  peso: number;
  status: "nao_iniciado" | "em_andamento" | "concluido";
  progresso: number;
  topicos: string[] | TopicoAninhado[];
  quiz_estrelas?: number | null;
  proficiencia?: Proficiencia | null;
  flashcards_pendentes?: number;
}

const STATUS_LABELS: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

const STATUS_COLORS: Record<string, string> = {
  nao_iniciado: "text-gray-400",
  em_andamento: "text-blue-600",
  concluido: "text-green-600",
};

interface Props {
  modulo: Modulo;
  onAvancar: (id: number, progresso: number) => Promise<void>;
}

function isNested(topicos: string[] | TopicoAninhado[]): topicos is TopicoAninhado[] {
  return topicos.length > 0 && typeof topicos[0] === "object";
}

function flattenSubtopicos(topicos: TopicoAninhado[]): string[] {
  return topicos.flatMap((t) => t.subtopicos);
}

/**
 * Bolinha de proficiência colorida por score.
 * cinza=sem tentativa, vermelho<50%, amarelo<80%, verde≥80%
 */
function ProfDot({
  entry,
  label,
}: {
  entry: ProficienciaEntry | undefined;
  label: string;
}) {
  if (!entry) return (
    <span
      title={`${label} — sem tentativa`}
      className="inline-block w-2 h-2 rounded-full bg-gray-200"
    />
  );

  const color =
    entry.dominado
      ? "bg-green-500"
      : entry.score >= 0.5
      ? "bg-yellow-400"
      : "bg-red-400";

  return (
    <span
      title={`${label} — ${Math.round(entry.score * 100)}% (${entry.melhor_acertos}/${entry.total})`}
      className={`inline-block w-2 h-2 rounded-full ${color}`}
    />
  );
}

/**
 * Barra de proficiência compacta para tópicos.
 */
function TopicoProfBar({ entry, nome }: { entry: ProficienciaEntry | undefined; nome: string }) {
  if (!entry) return null;
  const pct = Math.round(entry.score * 100);
  const color = entry.dominado ? "bg-green-500" : entry.score >= 0.5 ? "bg-yellow-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-1.5 mt-1" title={`${nome}: ${pct}%`}>
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 w-6 text-right">{pct}%</span>
    </div>
  );
}

export function ModuloCard({ modulo, onAvancar }: Props) {
  const pesoPercent = Math.round(modulo.peso * 100);
  const nested = isNested(modulo.topicos);

  const allItems: string[] = nested
    ? flattenSubtopicos(modulo.topicos as TopicoAninhado[])
    : (modulo.topicos as string[]);
  const total = allItems.length;

  const initialChecked = total > 0
    ? Array.from({ length: total }, (_, i) => i < Math.round((modulo.progresso / 100) * total))
    : [];

  const [checked, setChecked] = useState<boolean[]>(initialChecked);
  const [expanded, setExpanded] = useState<boolean[]>(() =>
    nested ? (modulo.topicos as TopicoAninhado[]).map(() => true) : []
  );
  const [chatAberto, setChatAberto] = useState(false);
  const [quizAberto, setQuizAberto] = useState(false);
  const [flashcardAberto, setFlashcardAberto] = useState(false);
  const [flashcardsPendentes, setFlashcardsPendentes] = useState(
    modulo.flashcards_pendentes ?? 0
  );

  // Proficiência: estado derivado da API, atualizável após quiz
  const [proficiencia, setProficiencia] = useState<Proficiencia>(
    modulo.proficiencia ?? { modulo: null, topicos: {}, subtopicos: {} }
  );
  const [quizEstrelas, setQuizEstrelas] = useState<number | null>(modulo.quiz_estrelas ?? null);

  async function handleToggle(index: number) {
    const next = checked.map((v, i) => (i === index ? !v : v));
    setChecked(next);
    const doneCount = next.filter(Boolean).length;
    const novoProgresso = total > 0 ? (doneCount / total) * 100 : 0;
    await onAvancar(modulo.id, novoProgresso);
  }

  function toggleExpanded(i: number) {
    setExpanded((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function handleQuizConcluido(
    estrelas: number,
    tipo: string,
    referencia: string,
    resultado: { melhor_score: number; acertos: number; total: number; dominado: boolean }
  ) {
    if (tipo === "modulo") setQuizEstrelas(estrelas);

    // Atualização otimista da proficiência — evita refresh de página
    const entry: ProficienciaEntry = {
      melhor_acertos: Math.round(resultado.melhor_score * resultado.total),
      total: resultado.total,
      score: resultado.melhor_score,
      dominado: resultado.dominado,
      tentativas: 1,
    };

    setProficiencia((prev) => {
      if (tipo === "modulo") return { ...prev, modulo: entry };
      if (tipo === "topico") return { ...prev, topicos: { ...prev.topicos, [referencia]: entry } };
      if (tipo === "subtopico") return { ...prev, subtopicos: { ...prev.subtopicos, [referencia]: entry } };
      return prev;
    });
  }

  const doneCount = checked.filter(Boolean).length;
  const progressoLocal = total > 0 ? (doneCount / total) * 100 : modulo.progresso;
  const statusLocal =
    progressoLocal >= 100 ? "concluido" : progressoLocal > 0 ? "em_andamento" : "nao_iniciado";

  function topicoOffset(topicoIdx: number): number {
    const topicos = modulo.topicos as TopicoAninhado[];
    return topicos.slice(0, topicoIdx).reduce((acc, t) => acc + t.subtopicos.length, 0);
  }

  return (
    <div className={`border rounded-lg p-4 flex flex-col gap-3 ${statusLocal === "concluido" ? "border-green-200 bg-green-50" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs text-gray-400 font-mono">#{modulo.ordem}</span>
          <h3 className="font-semibold">{modulo.nome}</h3>
          <span className="text-xs text-gray-500">Peso histórico: {pesoPercent}%</span>
        </div>
        <span className={`text-xs font-medium ${STATUS_COLORS[statusLocal]}`}>
          {STATUS_LABELS[statusLocal]}
        </span>
      </div>

      {/* Barra de progresso */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progresso</span>
          <span>{doneCount}/{total} {nested ? "subtópicos" : "tópicos"}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${statusLocal === "concluido" ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${progressoLocal}%` }}
          />
        </div>
      </div>

      {/* Tópicos — formato aninhado */}
      {nested && total > 0 && (
        <ul className="flex flex-col gap-2">
          {(modulo.topicos as TopicoAninhado[]).map((topico, ti) => {
            const offset = topicoOffset(ti);
            const subtotalDone = topico.subtopicos.filter((_, si) => checked[offset + si]).length;
            const topicoCompleto = subtotalDone === topico.subtopicos.length;
            const topicoProfEntry = proficiencia.topicos[topico.nome];

            return (
              <li key={ti} className="border rounded-md overflow-hidden">
                {/* Cabeçalho do tópico */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(ti)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${topicoCompleto ? "text-green-700 line-through" : "text-gray-700"}`}>
                      {topico.nome}
                    </span>
                    {/* Barra de proficiência do tópico */}
                    {topicoProfEntry && (
                      <TopicoProfBar entry={topicoProfEntry} nome={topico.nome} />
                    )}
                  </div>
                  <span className="flex items-center gap-2 text-xs text-gray-400 shrink-0 ml-2">
                    {subtotalDone}/{topico.subtopicos.length}
                    <span>{expanded[ti] ? "▲" : "▼"}</span>
                  </span>
                </button>

                {/* Subtópicos */}
                {expanded[ti] && (
                  <ul className="flex flex-col gap-1 px-3 py-2">
                    {topico.subtopicos.map((sub, si) => {
                      const idx = offset + si;
                      const subProfEntry = proficiencia.subtopicos[sub];
                      return (
                        <li key={si}>
                          <label className="flex items-start gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checked[idx] ?? false}
                              onChange={() => handleToggle(idx)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 cursor-pointer"
                            />
                            <span className={`text-sm leading-snug flex-1 ${checked[idx] ? "line-through text-gray-400" : "text-gray-600 group-hover:text-gray-900"}`}>
                              {sub}
                            </span>
                            {/* Bolinha de proficiência do subtópico */}
                            <ProfDot entry={subProfEntry} label={sub} />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Tópicos — formato plano (legado) */}
      {!nested && total > 0 && (
        <ul className="flex flex-col gap-1.5">
          {(modulo.topicos as string[]).map((topico, i) => (
            <li key={i}>
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked[i] ?? false}
                  onChange={() => handleToggle(i)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 cursor-pointer"
                />
                <span className={`text-sm leading-snug ${checked[i] ? "line-through text-gray-400" : "text-gray-600 group-hover:text-gray-900"}`}>
                  {topico}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {/* Legenda de proficiência (só exibe se tiver dados) */}
      {(Object.keys(proficiencia.subtopicos).length > 0 || Object.keys(proficiencia.topicos).length > 0) && (
        <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-wrap">
          <span className="font-medium text-gray-500">Proficiência:</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> ≥ 80%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400" /> 50–79%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400" /> &lt; 50%</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-gray-200" /> sem quiz</span>
        </div>
      )}

      {/* Ações IA */}
      <div className="flex items-center gap-3 mt-1 flex-wrap">
        <button
          type="button"
          onClick={() => setChatAberto((v) => !v)}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          {chatAberto ? "▲ Fechar chat" : "💬 Perguntar à IA"}
        </button>
        <button
          type="button"
          onClick={() => setQuizAberto(true)}
          className="text-xs text-purple-600 hover:text-purple-800 transition-colors"
        >
          📝 {quizEstrelas !== null ? "Refazer quiz" : "Fazer quiz"}
        </button>

        {/* Botão de flashcards — aparece sempre que houve quiz (proficiência existe) */}
        {(proficiencia.modulo !== null ||
          Object.keys(proficiencia.topicos).length > 0 ||
          Object.keys(proficiencia.subtopicos).length > 0 ||
          flashcardsPendentes > 0) && (
          <button
            type="button"
            onClick={() => setFlashcardAberto(true)}
            className="text-xs text-orange-600 hover:text-orange-800 transition-colors flex items-center gap-1"
          >
            📚
            {flashcardsPendentes > 0 && (
              <span className="bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
                {flashcardsPendentes}
              </span>
            )}
            Flashcards
          </button>
        )}

        {/* Badge de estrelas do quiz de módulo */}
        {quizEstrelas !== null && (
          <span className="flex items-center gap-0.5 ml-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={`text-sm leading-none ${i < quizEstrelas! ? "text-yellow-400" : "text-gray-200"}`}
              >
                ★
              </span>
            ))}
          </span>
        )}
      </div>

      {chatAberto && <ChatExplicacao moduloNome={modulo.nome} />}

      {quizAberto && (
        <QuizModal
          moduloId={modulo.id}
          moduloNome={modulo.nome}
          topicos={modulo.topicos}
          proficiencia={proficiencia}
          onFechar={() => setQuizAberto(false)}
          onConcluido={handleQuizConcluido}
        />
      )}

      {flashcardAberto && (
        <FlashcardDeck
          moduloId={modulo.id}
          moduloNome={modulo.nome}
          tipo="modulo"
          referencia=""
          onFechar={() => setFlashcardAberto(false)}
          onDominioAtualizado={(pendentes) => setFlashcardsPendentes(pendentes)}
        />
      )}
    </div>
  );
}
