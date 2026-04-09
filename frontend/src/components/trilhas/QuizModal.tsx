"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Questao {
  enunciado: string;
  alternativas: { A: string; B: string; C: string; D: string };
  gabarito: "A" | "B" | "C" | "D";
  explicacao: string;
}

interface Props {
  moduloId: number;
  moduloNome: string;
  onFechar: () => void;
}

type Fase = "carregando" | "quiz" | "resultado" | "erro";

export function QuizModal({ moduloId, moduloNome, onFechar }: Props) {
  const [fase, setFase] = useState<Fase>("carregando");
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [atual, setAtual] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setErro("Faça login para usar o quiz."); setFase("erro"); return; }

    fetch(`${API_URL}/api/llm/quiz/${moduloId}/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.questoes?.length) throw new Error("Sem questões.");
        setQuestoes(data.questoes);
        setFase("quiz");
      })
      .catch((e) => { setErro(e.message || "Erro ao gerar quiz."); setFase("erro"); });
  }, [moduloId]);

  const questaoAtual = questoes[atual];
  const respondida = respostas[atual] !== undefined;
  const acertou = respondida && respostas[atual] === questaoAtual?.gabarito;
  const totalAcertos = questoes.filter((q, i) => respostas[i] === q.gabarito).length;

  function responder(letra: string) {
    if (respondida) return;
    setRespostas((prev) => ({ ...prev, [atual]: letra }));
    setMostrarExplicacao(true);
  }

  function proxima() {
    setMostrarExplicacao(false);
    if (atual + 1 < questoes.length) setAtual((v) => v + 1);
    else setFase("resultado");
  }

  function reiniciar() {
    setAtual(0);
    setRespostas({});
    setMostrarExplicacao(false);
    setFase("quiz");
  }

  const corAlternativa = (letra: string) => {
    if (!respondida) return "hover:bg-blue-50 hover:border-blue-300 cursor-pointer";
    if (letra === questaoAtual.gabarito) return "bg-green-50 border-green-400 text-green-800";
    if (letra === respostas[atual]) return "bg-red-50 border-red-400 text-red-800";
    return "opacity-50";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Quiz</p>
            <h2 className="font-semibold text-gray-800 leading-tight">{moduloNome}</h2>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* Carregando */}
          {fase === "carregando" && (
            <div className="flex flex-col items-center gap-3 py-10 text-gray-400">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm">Gerando questões com IA…</p>
            </div>
          )}

          {/* Erro */}
          {fase === "erro" && (
            <div className="py-8 text-center text-red-500 text-sm">{erro}</div>
          )}

          {/* Quiz */}
          {fase === "quiz" && questaoAtual && (
            <div className="flex flex-col gap-4">
              {/* Progresso */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Questão {atual + 1} de {questoes.length}</span>
                <span>{Object.keys(respostas).length} respondidas</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${((atual) / questoes.length) * 100}%` }}
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
                  <p className="font-semibold mb-1">{acertou ? "✓ Correto!" : `✗ Errado — gabarito: ${questaoAtual.gabarito}`}</p>
                  <p>{questaoAtual.explicacao}</p>
                </div>
              )}
            </div>
          )}

          {/* Resultado final */}
          {fase === "resultado" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className={`text-5xl font-bold ${totalAcertos >= 4 ? "text-green-500" : totalAcertos >= 3 ? "text-yellow-500" : "text-red-500"}`}>
                {totalAcertos}/{questoes.length}
              </div>
              <p className="text-gray-600 text-sm">
                {totalAcertos === questoes.length
                  ? "Perfeito! Domínio total do módulo."
                  : totalAcertos >= 4
                  ? "Muito bom! Apenas pequenas lacunas."
                  : totalAcertos >= 3
                  ? "Bom progresso, mas revise os erros."
                  : "Revise o módulo antes de continuar."}
              </p>
              <div className="flex gap-2 w-full">
                <button
                  onClick={reiniciar}
                  className="flex-1 text-sm border border-blue-600 text-blue-600 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Refazer quiz
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

        {/* Footer — botão Próxima */}
        {fase === "quiz" && respondida && (
          <div className="px-5 py-4 border-t">
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
