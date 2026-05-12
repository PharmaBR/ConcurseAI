"use client";

import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface MensagemChat {
  role: "user" | "assistant";
  content: string;
}

interface UseLLMStreamOptions {
  moduloNome: string;
  topicoNome?: string;
  topicos?: unknown[];
}

export function useLLMStream({ moduloNome, topicoNome, topicos }: UseLLMStreamOptions) {
  const [historico, setHistorico] = useState<MensagemChat[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Mantém compatibilidade: expõe a última resposta do assistente
  const resposta = historico.filter((m) => m.role === "assistant").at(-1)?.content ?? "";

  const enviar = useCallback(
    async (pergunta: string) => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setErro("Faça login para usar o chat.");
        return;
      }

      // Adiciona a mensagem do usuário ao histórico imediatamente
      const novoHistorico: MensagemChat[] = [...historico, { role: "user", content: pergunta }];
      setHistorico(novoHistorico);
      setErro(null);
      setStreaming(true);

      // Placeholder da resposta do assistente (será preenchida em streaming)
      setHistorico((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch(`${API_URL}/api/llm/explicar/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            pergunta,
            modulo_nome: moduloNome,
            topico_nome: topicoNome ?? "",
            ...(topicos && topicos.length > 0 && { topicos }),
            // Envia o histórico anterior (sem a mensagem atual do usuário)
            ...(historico.length > 0 && { historico }),
          }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setErro((data as { detail?: string }).detail ?? "Erro ao conectar com a IA.");
          // Remove o placeholder vazio do assistente
          setHistorico((prev) => prev.slice(0, -1));
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const json = JSON.parse(dataLine.slice(6)) as {
                token?: string;
                fim?: boolean;
                erro?: string;
              };
              if (json.token) {
                // Acumula token na última mensagem do assistente
                setHistorico((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: updated[updated.length - 1].content + json.token,
                  };
                  return updated;
                });
              } else if (json.erro) {
                setErro(json.erro);
              }
            } catch {
              // chunk incompleto — ignora
            }
          }
        }
      } catch {
        setErro("Erro de conexão com o servidor.");
        setHistorico((prev) => prev.slice(0, -1));
      } finally {
        setStreaming(false);
      }
    },
    [moduloNome, topicoNome, topicos, historico]
  );

  const limpar = useCallback(() => {
    setHistorico([]);
    setErro(null);
  }, []);

  return { historico, resposta, streaming, erro, enviar, limpar };
}
