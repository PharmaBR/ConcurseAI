"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Questao {
  enunciado: string;
  alternativas: { A: string; B: string; C: string; D: string };
  gabarito: "A" | "B" | "C" | "D";
  explicacao: string;
  dificuldade?: "facil" | "medio" | "dificil";
  nivel?: "subtopico" | "topico" | "modulo";
}

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

interface Props {
  moduloId: number;
  moduloNome: string;
  topicos: string[] | TopicoAninhado[];
  proficiencia?: Proficiencia;
  onFechar: () => void;
  onConcluido?: (estrelas: number, tipo: string, referencia: string) => void;
}

type Fase =
  | "selecionando_nivel"
  | "selecionando_item"
  | "carregando"
  | "quiz"
  | "salvando"
  | "resultado"
  | "erro";

type TipoQuiz = "subtopico" | "topico" | "modulo";

const DIFICULDADE_LABEL: Record<string, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};
const DIFICULDADE_COLOR: Record<string, string> = {
  facil: "bg-green-100 text-green-700",
  medio: "bg-yellow-100 text-yellow-700",
  dificil: "bg-red-100 text-red-700",
};
const NIVEL_LABEL: Record<string, string> = {
  subtopico: "Subtópico",
  topico: "Tópico",
  modulo: "Módulo",
};

function Estrelas({ total, preenchidas }: { total: number; preenchidas: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`text-xl ${i < preenchidas ? "text-yellow-400" : "text-gray-200"}`}>
          ★
        </span>
      ))}
    </div>
  );
}

function isNested(topicos: string[] | TopicoAninhado[]): topicos is TopicoAninhado[] {
  return topicos.length > 0 && typeof topicos[0] === "object";
}

/** Badge inline de proficiência: score colorido ou "—" se sem tentativa. */
function ProfBadge({ entry }: { entry: ProficienciaEntry | undefined }) {
  if (!entry) return <span className="text-[10px] text-gray-300 font-mono">—</span>;
  const pct = Math.round(entry.score * 100);
  const color = entry.dominado
    ? "text-green-600 bg-green-50 border-green-200"
    : entry.score >= 0.5
    ? "text-yellow-600 bg-yellow-50 border-yellow-200"
    : "text-red-500 bg-red-50 border-red-200";
  return (
    <span className={`text-[10px] font-medium border rounded px-1 py-0.5 ${color}`}>
      {entry.dominado ? "✓ " : ""}{pct}%
    </span>
  );
}

export function QuizModal({ moduloId, moduloNome, topicos, proficiencia, onFechar, onConcluido }: Props) {
  const prof = proficiencia ?? { modulo: null, topicos: {}, subtopicos: {} };
  const nested = isNested(topicos);

  // Seleção de nível
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoQuiz>("modulo");
  const [regenerar, setRegerar] = useState(false);
  const [topicoSelecionado, setTopicoSelecionado] = useState<TopicoAninhado | null>(null);
  const [subtopico, setSubtopico] = useState("");

  // Quiz
  const [fase, setFase] = useState<Fase>("selecionando_nivel");
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);
  const [resultado, setResultado] = useState<{
    acertos: number;
    total: number;
    estrelas: number;
    melhor_score?: number;
    dominado?: boolean;
  } | null>(null);
  const [erro, setErro] = useState("");

  // ──────────────────────────────────────────────
  // Seleção de nível
  // ──────────────────────────────────────────────

  function handleConfirmarNivel() {
    if (tipoSelecionado === "modulo") {
      iniciarQuiz("modulo", "");
    } else if (tipoSelecionado === "topico") {
      setFase("selecionando_item");
    } else {
      setFase("selecionando_item");
    }
  }

  function handleConfirmarItem() {
    if (tipoSelecionado === "topico" && topicoSelecionado) {
      iniciarQuiz("topico", topicoSelecionado.nome);
    } else if (tipoSelecionado === "subtopico" && topicoSelecionado && subtopico) {
      iniciarQuiz("subtopico", subtopico, topicoSelecionado.nome);
    }
  }

  // ──────────────────────────────────────────────
  // Geração do quiz
  // ──────────────────────────────────────────────

  async function iniciarQuiz(tipo: TipoQuiz, referencia: string, topico_nome = "") {
    setFase("carregando");
    const token = localStorage.getItem("access_token");
    if (!token) { setErro("Faça login para usar o quiz."); setFase("erro"); return; }

    try {
      const res = await fetch(`${API_URL}/api/llm/quiz/${moduloId}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tipo, referencia, topico_nome, ...(regenerar && { regenerar: true }) }),
      });
      const data = await res.json();
      if (!data.questoes?.length) throw new Error("Sem questões.");
      setQuestoes(data.questoes);
      setFase("quiz");
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar quiz.");
      setFase("erro");
    }
  }

  // ──────────────────────────────────────────────
  // Lógica do quiz
  // ──────────────────────────────────────────────

  const questaoAtual = questoes[atual];
  const respondida = respostas[atual] !== undefined;
  const acertou = respondida && respostas[atual] === questaoAtual?.gabarito;

  function responder(letra: string) {
    if (respondida) return;
    setRespostas((prev) => ({ ...prev, [atual]: letra }));
    setMostrarExplicacao(true);
  }

  async function proxima() {
    setMostrarExplicacao(false);
    if (atual + 1 < questoes.length) {
      setAtual((v) => v + 1);
    } else {
      await salvarTentativa();
    }
  }

  async function salvarTentativa() {
    setFase("salvando");
    const token = localStorage.getItem("access_token");

    // tipo e referencia são os que foram usados para gerar o quiz
    const tipo = tipoSelecionado;
    const referencia =
      tipo === "subtopico" ? subtopico : tipo === "topico" ? (topicoSelecionado?.nome ?? "") : "";

    try {
      const res = await fetch(`${API_URL}/api/llm/quiz/${moduloId}/tentativa/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          respostas: Object.fromEntries(Object.entries(respostas).map(([k, v]) => [String(k), v])),
          tipo,
          referencia,
        }),
      });
      const data = await res.json();
      setResultado(data);
      onConcluido?.(data.estrelas, tipo, referencia);
    } catch {
      const acertos = questoes.filter((q, i) => respostas[i] === q.gabarito).length;
      setResultado({ acertos, total: questoes.length, estrelas: acertos });
    } finally {
      setFase("resultado");
    }
  }

  function reiniciar() {
    setAtual(0);
    setRespostas({});
    setMostrarExplicacao(false);
    setResultado(null);
    setFase("selecionando_nivel");
    setTopicoSelecionado(null);
    setSubtopico("");
    setRegerar(false);
  }

  const corAlternativa = (letra: string) => {
    if (!respondida) return "hover:bg-blue-50 hover:border-blue-300 cursor-pointer";
    if (letra === questaoAtual.gabarito) return "bg-green-50 border-green-400 text-green-800";
    if (letra === respostas[atual]) return "bg-red-50 border-red-400 text-red-800";
    return "opacity-40";
  };

  const mensagemResultado = (estrelas: number) => {
    if (estrelas === 5) return "Perfeito! Domínio total. ✨";
    if (estrelas === 4) return "Excelente! Apenas um detalhe a revisar.";
    if (estrelas === 3) return "Bom progresso — revise os erros antes de avançar.";
    if (estrelas === 2) return "Estude mais antes de continuar.";
    return "Revise o conteúdo e refaça o quiz.";
  };

  // Labels contextuais
  const nivelAtual =
    tipoSelecionado === "subtopico"
      ? `Subtópico: ${subtopico}`
      : tipoSelecionado === "topico"
      ? `Tópico: ${topicoSelecionado?.nome ?? ""}`
      : "Módulo completo";

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Quiz</p>
            <h2 className="font-semibold text-gray-800 leading-tight">{moduloNome}</h2>
            {(fase === "quiz" || fase === "resultado") && (
              <p className="text-xs text-blue-500 mt-0.5">{nivelAtual}</p>
            )}
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* ── SELEÇÃO DE NÍVEL ── */}
          {fase === "selecionando_nivel" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-600 font-medium">Escolha o nível do quiz:</p>

              <div className="flex flex-col gap-2">
                {[
                  {
                    id: "subtopico" as TipoQuiz,
                    label: "Por Subtópico",
                    desc: "5 questões focadas em 1 subtópico — diagnóstico granular",
                    icon: "🔬",
                    disabled: !nested,
                    profEntry: undefined as ProficienciaEntry | undefined,
                  },
                  {
                    id: "topico" as TipoQuiz,
                    label: "Por Tópico",
                    desc: "5 questões integrando os subtópicos de 1 tópico",
                    icon: "📖",
                    disabled: !nested,
                    profEntry: undefined as ProficienciaEntry | undefined,
                  },
                  {
                    id: "modulo" as TipoQuiz,
                    label: "Módulo completo",
                    desc: "5 questões interdisciplinares cruzando todos os tópicos",
                    icon: "🎯",
                    disabled: false,
                    profEntry: prof.modulo ?? undefined,
                  },
                ].map((op) => (
                  <button
                    key={op.id}
                    disabled={op.disabled}
                    onClick={() => setTipoSelecionado(op.id)}
                    className={`text-left border rounded-lg px-4 py-3 transition-colors ${
                      op.disabled
                        ? "opacity-40 cursor-not-allowed border-gray-200"
                        : tipoSelecionado === op.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-gray-800">
                        {op.icon} {op.label}
                      </span>
                      <ProfBadge entry={op.profEntry} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{op.desc}</p>
                  </button>
                ))}
              </div>

              {/* Opção de regenerar */}
              <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                <input
                  type="checkbox"
                  checked={regenerar}
                  onChange={(e) => setRegerar(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                />
                <span className="text-xs text-gray-500">
                  Gerar novas questões (ignora cache)
                </span>
              </label>

              <button
                onClick={handleConfirmarNivel}
                className="w-full mt-1 bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ── SELEÇÃO DE ITEM (tópico ou subtópico) ── */}
          {fase === "selecionando_item" && nested && (
            <div className="flex flex-col gap-4">
              {tipoSelecionado === "topico" ? (
                <>
                  <p className="text-sm text-gray-600 font-medium">Selecione o tópico:</p>
                  <ul className="flex flex-col gap-1.5">
                    {(topicos as TopicoAninhado[]).map((t) => (
                      <li key={t.nome}>
                        <button
                          onClick={() => setTopicoSelecionado(t)}
                          className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm transition-colors ${
                            topicoSelecionado?.nome === t.nome
                              ? "border-blue-500 bg-blue-50 text-blue-800"
                              : "border-gray-200 hover:border-gray-300 text-gray-700"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{t.nome}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-gray-400">
                                {t.subtopicos.length} subtópicos
                              </span>
                              <ProfBadge entry={prof.topicos[t.nome]} />
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                /* subtopico — primeiro seleciona o tópico pai, depois o subtópico */
                <>
                  {!topicoSelecionado ? (
                    <>
                      <p className="text-sm text-gray-600 font-medium">Selecione o tópico pai:</p>
                      <ul className="flex flex-col gap-1.5">
                        {(topicos as TopicoAninhado[]).map((t) => (
                          <li key={t.nome}>
                            <button
                              onClick={() => setTopicoSelecionado(t)}
                              className="w-full text-left border rounded-lg px-3 py-2.5 text-sm border-gray-200 hover:border-gray-300 text-gray-700 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span>{t.nome}</span>
                                <ProfBadge entry={prof.topicos[t.nome]} />
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setTopicoSelecionado(null); setSubtopico(""); }}
                        className="text-xs text-blue-500 hover:underline text-left"
                      >
                        ← {topicoSelecionado.nome}
                      </button>
                      <p className="text-sm text-gray-600 font-medium">Selecione o subtópico:</p>
                      <ul className="flex flex-col gap-1.5">
                        {topicoSelecionado.subtopicos.map((sub) => (
                          <li key={sub}>
                            <button
                              onClick={() => setSubtopico(sub)}
                              className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm transition-colors ${
                                subtopico === sub
                                  ? "border-blue-500 bg-blue-50 text-blue-800"
                                  : "border-gray-200 hover:border-gray-300 text-gray-700"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span>{sub}</span>
                                <ProfBadge entry={prof.subtopicos[sub]} />
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setFase("selecionando_nivel"); setTopicoSelecionado(null); setSubtopico(""); }}
                  className="flex-1 text-sm border border-gray-300 text-gray-600 py-2 rounded-lg hover:bg-gray-50"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleConfirmarItem}
                  disabled={
                    tipoSelecionado === "topico" ? !topicoSelecionado :
                    !topicoSelecionado || !subtopico
                  }
                  className="flex-1 text-sm bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Gerar quiz →
                </button>
              </div>
            </div>
          )}

          {/* ── CARREGANDO / SALVANDO ── */}
          {(fase === "carregando" || fase === "salvando") && (
            <div className="flex flex-col items-center gap-3 py-10 text-gray-400">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm">
                {fase === "carregando" ? "Gerando questões com IA…" : "Salvando resultado…"}
              </p>
            </div>
          )}

          {/* ── ERRO ── */}
          {fase === "erro" && (
            <div className="py-8 text-center text-red-500 text-sm">{erro}</div>
          )}

          {/* ── QUIZ ── */}
          {fase === "quiz" && questaoAtual && (
            <div className="flex flex-col gap-4">
              {/* Progresso */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Questão {atual + 1} de {questoes.length}</span>
                <div className="flex gap-1.5">
                  {questaoAtual.dificuldade && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${DIFICULDADE_COLOR[questaoAtual.dificuldade] ?? ""}`}>
                      {DIFICULDADE_LABEL[questaoAtual.dificuldade]}
                    </span>
                  )}
                  {questaoAtual.nivel && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
                      {NIVEL_LABEL[questaoAtual.nivel]}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(atual / questoes.length) * 100}%` }}
                />
              </div>

              {/* Enunciado */}
              <p className="text-sm text-gray-800 leading-relaxed font-medium">
                {questaoAtual.enunciado}
              </p>

              {/* Alternativas */}
              <ul className="flex flex-col gap-2">
                {(["A", "B", "C", "D"] as const).map((letra) => (
                  <li key={letra}>
                    <button
                      onClick={() => responder(letra)}
                      disabled={respondida}
                      className={`w-full text-left text-sm border rounded-lg px-3 py-2.5 transition-colors flex gap-2 ${corAlternativa(letra)}`}
                    >
                      <span className="font-bold shrink-0 w-4">{letra})</span>
                      <span>{questaoAtual.alternativas[letra]}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Explicação */}
              {mostrarExplicacao && (
                <div className={`rounded-lg px-3 py-2.5 text-sm leading-relaxed ${acertou ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                  <p className="font-semibold mb-1">
                    {acertou ? "✓ Correto!" : `✗ Errado — gabarito: ${questaoAtual.gabarito}`}
                  </p>
                  <p>{questaoAtual.explicacao}</p>
                </div>
              )}
            </div>
          )}

          {/* ── RESULTADO ── */}
          {fase === "resultado" && resultado && (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <Estrelas total={5} preenchidas={resultado.estrelas} />
              <div>
                <p className="text-3xl font-bold text-gray-800">
                  {resultado.acertos}/{resultado.total}
                </p>
                <p className="text-sm text-gray-500 mt-1">{mensagemResultado(resultado.estrelas)}</p>
                {resultado.dominado !== undefined && (
                  <p className={`text-xs font-medium mt-2 ${resultado.dominado ? "text-green-600" : "text-orange-500"}`}>
                    {resultado.dominado ? "✓ Conteúdo dominado (≥ 80%)" : "Ainda não dominado — continue praticando"}
                  </p>
                )}
              </div>

              {/* Resumo por questão */}
              <div className="w-full flex gap-1.5 justify-center">
                {questoes.map((q, i) => (
                  <div
                    key={i}
                    title={`Q${i + 1}: ${respostas[i] === q.gabarito ? "Acertou" : "Errou"}`}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${respostas[i] === q.gabarito ? "bg-green-500" : "bg-red-400"}`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 w-full pt-2">
                <button
                  onClick={reiniciar}
                  className="flex-1 text-sm border border-blue-600 text-blue-600 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Novo quiz
                </button>
                <button
                  onClick={onFechar}
                  className="flex-1 text-sm bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer — Próxima / Ver resultado */}
        {fase === "quiz" && respondida && (
          <div className="px-5 py-4 border-t shrink-0">
            <button
              onClick={proxima}
              className="w-full text-sm bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {atual + 1 < questoes.length ? "Próxima questão →" : "Ver resultado"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
