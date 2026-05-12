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
  const [quizAutoStart, setQuizAutoStart] = useState<{
    tipo: "subtopico" | "topico" | "modulo";
    referencia: string;
    topico_nome?: string;
  } | null>(null);
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

  // Subtópicos com checkbox marcado — passados ao QuizModal para o toggle "só o que estudei"
  const subtopicosEstudados: string[] = nested
    ? (modulo.topicos as TopicoAninhado[]).flatMap((t, ti) =>
        t.subtopicos.filter((_, si) => checked[topicoOffset(ti) + si])
      )
    : (modulo.topicos as string[]).filter((_, i) => checked[i]);

  function abrirQuizSubtopico(subtopico: string, topicoNome: string) {
    setQuizAutoStart({ tipo: "subtopico", referencia: subtopico, topico_nome: topicoNome });
    setQuizAberto(true);
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
                          <div className="flex items-start gap-2 group">
                            <label className="flex items-start gap-2 cursor-pointer flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked[idx] ?? false}
                                onChange={() => handleToggle(idx)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 cursor-pointer"
                              />
                              <span className={`text-sm leading-snug flex-1 ${checked[idx] ? "line-through text-gray-400" : "text-gray-600 group-hover:text-gray-900"}`}>
                                {sub}
                              </span>
                            </label>
                            {/* Botão quiz direto por subtópico */}
                            <button
                              type="button"
                              onClick={() => abrirQuizSubtopico(sub, topico.nome)}
                              title={`Quiz: ${sub}`}
                              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-purple-500 hover:text-purple-700 border border-purple-200 hover:border-purple-400 rounded px-1 py-0.5 leading-none"
                            >
                              📝
                            </button>
                            {/* Bolinha de proficiência do subtópico */}
                            <ProfDot entry={subProfEntry} label={sub} />
                          </div>
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

      {/* ── Ações IA — bloco visual proeminente ── */}
      <div className="grid grid-cols-3 gap-2 mt-2">

        {/* Chat IA */}
        <button
          type="button"
          onClick={() => setChatAberto((v) => !v)}
          className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 border-2 transition-colors ${
            chatAberto
              ? "border-blue-400 bg-blue-100"
              : "border-blue-100 bg-blue-50 hover:bg-blue-100 hover:border-blue-300"
          }`}
        >
          <span className="text-lg leading-none">💬</span>
          <span className="text-xs font-semibold text-blue-700">Chat IA</span>
          <span className="text-[10px] text-blue-400 leading-tight text-center">
            {chatAberto ? "Fechar" : "Tire dúvidas"}
          </span>
        </button>

        {/* Quiz */}
        <button
          type="button"
          onClick={() => setQuizAberto(true)}
          className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 border-2 border-purple-100 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition-colors"
        >
          <span className="text-lg leading-none">📝</span>
          <span className="text-xs font-semibold text-purple-700">Quiz</span>
          {quizEstrelas !== null ? (
            <span className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`text-[10px] leading-none ${i < quizEstrelas! ? "text-yellow-400" : "text-gray-300"}`}>★</span>
              ))}
            </span>
          ) : (
            <span className="text-[10px] text-purple-400 leading-tight text-center">Testar nível</span>
          )}
        </button>

        {/* Flashcards */}
        <button
          type="button"
          onClick={() => setFlashcardAberto(true)}
          className="relative flex flex-col items-center gap-1 rounded-xl px-2 py-3 border-2 border-orange-100 bg-orange-50 hover:bg-orange-100 hover:border-orange-300 transition-colors"
        >
          {flashcardsPendentes > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
              {flashcardsPendentes}
            </span>
          )}
          <span className="text-lg leading-none">📚</span>
          <span className="text-xs font-semibold text-orange-700">Flashcards</span>
          <span className="text-[10px] text-orange-400 leading-tight text-center">
            {flashcardsPendentes > 0 ? `${flashcardsPendentes} para revisar` : "Fixar conceitos"}
          </span>
        </button>
      </div>

      {chatAberto && <ChatExplicacao moduloNome={modulo.nome} topicos={modulo.topicos} />}

      {quizAberto && (
        <QuizModal
          moduloId={modulo.id}
          moduloNome={modulo.nome}
          topicos={modulo.topicos}
          proficiencia={proficiencia}
          subtopicosEstudados={subtopicosEstudados}
          autoStart={quizAutoStart ?? undefined}
          onFechar={() => { setQuizAberto(false); setQuizAutoStart(null); }}
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
