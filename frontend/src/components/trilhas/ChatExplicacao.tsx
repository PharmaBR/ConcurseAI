"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { useLLMStream, MensagemChat } from "@/hooks/useLLMStream";

interface Props {
  moduloNome: string;
  topicos?: unknown[];
}

export function ChatExplicacao({ moduloNome, topicos }: Props) {
  const [pergunta, setPergunta] = useState("");
  const { historico, streaming, erro, enviar, limpar } = useLLMStream({ moduloNome, topicos });
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever historico changes or a token arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historico]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const texto = pergunta.trim();
    if (!texto || streaming) return;
    enviar(texto);
    setPergunta("");
  }

  // Detect the streaming placeholder: last message is assistant with empty content
  const lastMsg = historico.at(-1);
  const awaitingFirstToken =
    streaming && lastMsg?.role === "assistant" && lastMsg.content === "";

  return (
    <div className="border-t border-gray-100 pt-3 mt-1 flex flex-col gap-2">

      {/* Conversation thread */}
      {historico.length > 0 && (
        <div
          ref={scrollRef}
          className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1"
        >
          {historico.map((msg: MensagemChat, idx: number) => {
            const isUser = msg.role === "user";
            const isLastAssistant =
              !isUser && idx === historico.length - 1;

            if (isUser) {
              return (
                <div key={idx} className="flex justify-end">
                  <div className="bg-blue-600 text-white text-sm rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%] leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              );
            }

            // Assistant bubble
            return (
              <div key={idx} className="flex justify-start">
                <div className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-2xl rounded-tl-sm px-3 py-2.5 max-w-[92%] leading-relaxed prose prose-sm prose-blue">
                  {msg.content ? (
                    <>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                      {isLastAssistant && streaming && (
                        <span className="inline-block w-1.5 h-3.5 bg-blue-400 ml-0.5 align-middle animate-pulse rounded-sm" />
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}

          {/* Typing indicator — shown before the first token of the new turn */}
          {awaitingFirstToken && (
            <div className="flex justify-start">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
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
          placeholder={
            historico.length === 0
              ? `Dúvida sobre os tópicos de ${moduloNome}...`
              : "Pergunta de acompanhamento..."
          }
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

      {/* Clear conversation */}
      {historico.length > 0 && !streaming && (
        <button
          onClick={limpar}
          className="text-xs text-gray-400 hover:text-gray-600 self-end transition-colors"
        >
          Limpar conversa
        </button>
      )}
    </div>
  );
}
