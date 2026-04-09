"use client";

import { useState } from "react";
import { useLLMStream } from "@/hooks/useLLMStream";

interface Props {
  moduloNome: string;
}

export function ChatExplicacao({ moduloNome }: Props) {
  const [pergunta, setPergunta] = useState("");
  const { resposta, streaming, erro, enviar, limpar } = useLLMStream({ moduloNome });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const texto = pergunta.trim();
    if (!texto || streaming) return;
    enviar(texto);
    setPergunta("");
  }

  return (
    <div className="border-t border-gray-100 pt-3 mt-1 flex flex-col gap-2">
      {/* Resposta em streaming */}
      {resposta && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {resposta}
          {streaming && (
            <span className="inline-block w-1.5 h-3.5 bg-blue-400 ml-0.5 align-middle animate-pulse rounded-sm" />
          )}
        </div>
      )}

      {/* Indicador de carregamento antes da 1ª palavra chegar */}
      {streaming && !resposta && (
        <div className="flex items-center gap-1.5 text-xs text-blue-500">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      )}

      {/* Erro */}
      {erro && <p className="text-xs text-red-500">{erro}</p>}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder={`Dúvida sobre ${moduloNome}...`}
          disabled={streaming}
          className="flex-1 text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          type="submit"
          disabled={streaming || !pergunta.trim()}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors shrink-0"
        >
          {streaming ? "..." : "Enviar"}
        </button>
      </form>

      {/* Botão limpar */}
      {resposta && !streaming && (
        <button
          onClick={limpar}
          className="text-xs text-gray-400 hover:text-gray-600 self-end transition-colors"
        >
          Limpar resposta
        </button>
      )}
    </div>
  );
}
