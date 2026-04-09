"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Flashcard {
  id: number;
  frente: string;
  verso: string;
  dominado: boolean;
  acertos_consecutivos: number;
  acertos_para_dominio: number;
}

interface Lacuna {
  id: number;
  numero_questao: number;
  subtopico_ref: string;
  conceito: string;
  flashcard: Flashcard | null;
}

interface Props {
  moduloId: number;
  moduloNome: string;
  /** Gera lacunas a partir de uma tentativa específica */
  tentativaId?: number;
  /** Gera lacunas a partir da tentativa mais recente deste nível (alternativa ao tentativaId) */
  tipo?: string;
  referencia?: string;
  onFechar: () => void;
  onDominioAtualizado?: (pendentes: number) => void;
}

type Fase = "carregando" | "deck" | "concluido" | "erro";

export function FlashcardDeck({
  moduloId,
  moduloNome,
  tentativaId,
  tipo,
  referencia,
  onFechar,
  onDominioAtualizado,
}: Props) {
  const [fase, setFase] = useState<Fase>("carregando");
  const [lacunas, setLacunas] = useState<Lacuna[]>([]);
  const [indice, setIndice] = useState(0);
  const [virado, setVirado] = useState(false);
  const [respondendo, setRespondendo] = useState(false);
  const [erro, setErro] = useState("");

  // ──────────────────────────────────────────────
  // Carregamento inicial
  // ──────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setErro("Faça login para usar os flashcards."); setFase("erro"); return; }

    async function carregar() {
      try {
        // Gera lacunas: via tentativaId específico, via tipo+referencia, ou nenhum (só lista)
        if (tentativaId || tipo !== undefined) {
          const body = tentativaId
            ? { tentativa_id: tentativaId }
            : { tipo: tipo ?? "modulo", referencia: referencia ?? "" };

          const res = await fetch(`${API_URL}/api/llm/quiz/${moduloId}/lacunas/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Erro ao gerar lacunas.");
          }
        }

        // Busca todas as lacunas (incluindo tentativas anteriores) com flashcards pendentes
        const res2 = await fetch(`${API_URL}/api/llm/quiz/${moduloId}/lacunas/listar/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res2.json();

        // Filtra só as lacunas com flashcard não dominado
        const pendentes: Lacuna[] = (data.lacunas ?? []).filter(
          (l: Lacuna) => l.flashcard && !l.flashcard.dominado
        );

        if (pendentes.length === 0) {
          setFase("concluido");
        } else {
          setLacunas(pendentes);
          setFase("deck");
        }
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar flashcards.");
        setFase("erro");
      }
    }

    carregar();
  }, [moduloId, tentativaId]);

  // ──────────────────────────────────────────────
  // Responder flashcard
  // ──────────────────────────────────────────────
  async function responder(acertou: boolean) {
    if (respondendo) return;
    const lacunaAtual = lacunas[indice];
    if (!lacunaAtual?.flashcard) return;

    setRespondendo(true);
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(
        `${API_URL}/api/llm/flashcards/${lacunaAtual.flashcard.id}/responder/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ acertou }),
        }
      );
      const data = await res.json();

      // Atualiza o flashcard na lista local
      setLacunas((prev) =>
        prev.map((l, i) =>
          i === indice && l.flashcard
            ? {
                ...l,
                flashcard: {
                  ...l.flashcard,
                  acertos_consecutivos: data.acertos_consecutivos,
                  dominado: data.dominado,
                },
              }
            : l
        )
      );

      avancar(data.dominado);
    } catch {
      // Avança mesmo com erro de rede
      avancar(false);
    } finally {
      setRespondendo(false);
    }
  }

  function avancar(dominadoAgora: boolean) {
    setVirado(false);

    // Remove o card dominado da fila ou avança para o próximo
    setLacunas((prev) => {
      const atualizado = dominadoAgora
        ? prev.filter((_, i) => i !== indice)
        : prev;

      const proximoIndice = dominadoAgora
        ? Math.min(indice, atualizado.length - 1)
        : (indice + 1) % prev.length;

      if (atualizado.length === 0) {
        setFase("concluido");
        onDominioAtualizado?.(0);
      } else {
        setIndice(Math.max(0, proximoIndice));
        onDominioAtualizado?.(atualizado.length);
      }

      return atualizado;
    });
  }

  // ──────────────────────────────────────────────
  // Render helpers
  // ──────────────────────────────────────────────
  const lacunaAtual = lacunas[indice];
  const total = lacunas.length;
  const progresso = lacunaAtual?.flashcard
    ? (lacunaAtual.flashcard.acertos_consecutivos / lacunaAtual.flashcard.acertos_para_dominio) * 100
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Flashcards</p>
            <h2 className="font-semibold text-gray-800 leading-tight">{moduloNome}</h2>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto flex-1 px-5 py-6">

          {/* Carregando */}
          {fase === "carregando" && (
            <div className="flex flex-col items-center gap-3 py-10 text-gray-400">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
              <p className="text-sm">
                {tentativaId || tipo !== undefined
                  ? "Analisando seus erros com IA…"
                  : "Carregando flashcards…"}
              </p>
            </div>
          )}

          {/* Erro */}
          {fase === "erro" && (
            <div className="py-8 text-center text-red-500 text-sm">{erro}</div>
          )}

          {/* Concluído */}
          {fase === "concluido" && (
            <div className="flex flex-col items-center gap-5 py-6 text-center">
              <div className="text-5xl">🎉</div>
              <div>
                <p className="text-xl font-bold text-gray-800">Todos os conceitos dominados!</p>
                <p className="text-sm text-gray-500 mt-2">
                  Você acertou cada flashcard {Flashcard_ACERTOS_PARA_DOMINIO}x seguidas.
                  Esses conceitos estão fixados.
                </p>
              </div>
              <button
                onClick={onFechar}
                className="mt-2 bg-purple-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Deck */}
          {fase === "deck" && lacunaAtual?.flashcard && (
            <div className="flex flex-col gap-4">

              {/* Contador + subtópico */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{total} flashcard{total !== 1 ? "s" : ""} pendente{total !== 1 ? "s" : ""}</span>
                <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-[10px] font-medium truncate max-w-[180px]">
                  {lacunaAtual.subtopico_ref}
                </span>
              </div>

              {/* Conceito */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {lacunaAtual.conceito}
              </p>

              {/* Card flip */}
              <div
                onClick={() => !virado && setVirado(true)}
                className={`relative rounded-xl border-2 transition-colors min-h-[180px] flex flex-col justify-center p-5 cursor-pointer select-none
                  ${virado
                    ? "border-purple-200 bg-purple-50"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white"
                  }`}
              >
                {!virado ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="text-2xl">🃏</span>
                    <p className="text-sm font-medium text-gray-800 leading-relaxed">
                      {lacunaAtual.flashcard.frente}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Toque para revelar a resposta</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wide mb-1">Resposta</p>
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {lacunaAtual.flashcard.verso}
                    </p>
                  </div>
                )}
              </div>

              {/* Barra de progresso do flashcard atual */}
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>Acertos consecutivos</span>
                  <span>
                    {lacunaAtual.flashcard.acertos_consecutivos}/
                    {lacunaAtual.flashcard.acertos_para_dominio} para dominar
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              </div>

              {/* Botões de resposta (só após virar) */}
              {virado && (
                <div className="flex gap-3 mt-1">
                  <button
                    onClick={() => responder(false)}
                    disabled={respondendo}
                    className="flex-1 border border-red-300 text-red-600 text-sm py-2.5 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    ✗ Errei
                  </button>
                  <button
                    onClick={() => responder(true)}
                    disabled={respondendo}
                    className="flex-1 border border-green-400 text-green-700 text-sm py-2.5 rounded-lg hover:bg-green-50 disabled:opacity-40 transition-colors font-medium"
                  >
                    ✓ Acertei
                  </button>
                </div>
              )}

              {/* Hint antes de virar */}
              {!virado && (
                <p className="text-center text-xs text-gray-400">
                  Pense na resposta antes de revelar
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Constante acessível fora da classe para a tela de concluído
const Flashcard_ACERTOS_PARA_DOMINIO = 2;
