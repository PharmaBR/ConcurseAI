"use client";

// TODO FASE 3: ModuloCard usa GenerativeUI para feedback em tempo real

import { useState } from "react";
import { ChatExplicacao } from "./ChatExplicacao";
import { QuizModal } from "./QuizModal";

interface TopicoAninhado {
  nome: string;
  subtopicos: string[];
}

interface Modulo {
  id: number;
  nome: string;
  ordem: number;
  peso: number;
  status: "nao_iniciado" | "em_andamento" | "concluido";
  progresso: number;
  topicos: string[] | TopicoAninhado[];
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

export function ModuloCard({ modulo, onAvancar }: Props) {
  const pesoPercent = Math.round(modulo.peso * 100);
  const nested = isNested(modulo.topicos);

  // Total checkable items: subtopics (nested) or topics (flat)
  const allItems: string[] = nested
    ? flattenSubtopicos(modulo.topicos as TopicoAninhado[])
    : (modulo.topicos as string[]);
  const total = allItems.length;

  // Initialize checkboxes from saved progress
  const initialChecked = total > 0
    ? Array.from({ length: total }, (_, i) => i < Math.round((modulo.progresso / 100) * total))
    : [];

  const [checked, setChecked] = useState<boolean[]>(initialChecked);
  const [expanded, setExpanded] = useState<boolean[]>(() =>
    nested ? (modulo.topicos as TopicoAninhado[]).map(() => true) : []
  );
  const [chatAberto, setChatAberto] = useState(false);
  const [quizAberto, setQuizAberto] = useState(false);

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

  const doneCount = checked.filter(Boolean).length;
  const progressoLocal = total > 0 ? (doneCount / total) * 100 : modulo.progresso;
  const statusLocal =
    progressoLocal >= 100 ? "concluido" : progressoLocal > 0 ? "em_andamento" : "nao_iniciado";

  // For nested format, compute per-topic completion to show a checkmark on the header
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

            return (
              <li key={ti} className="border rounded-md overflow-hidden">
                {/* Cabeçalho do tópico — clicável para expandir/recolher */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(ti)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <span className={`text-sm font-medium ${topicoCompleto ? "text-green-700 line-through" : "text-gray-700"}`}>
                    {topico.nome}
                  </span>
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
                      return (
                        <li key={si}>
                          <label className="flex items-start gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checked[idx] ?? false}
                              onChange={() => handleToggle(idx)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 cursor-pointer"
                            />
                            <span className={`text-sm leading-snug ${checked[idx] ? "line-through text-gray-400" : "text-gray-600 group-hover:text-gray-900"}`}>
                              {sub}
                            </span>
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

      {/* Ações IA */}
      <div className="flex gap-3 mt-1">
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
          📝 Fazer quiz
        </button>
      </div>

      {chatAberto && <ChatExplicacao moduloNome={modulo.nome} />}

      {quizAberto && (
        <QuizModal
          moduloId={modulo.id}
          moduloNome={modulo.nome}
          onFechar={() => setQuizAberto(false)}
        />
      )}
    </div>
  );
}
