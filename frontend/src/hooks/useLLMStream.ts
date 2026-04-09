"use client";

import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UseLLMStreamOptions {
  moduloNome: string;
  topicoNome?: string;
}

export function useLLMStream({ moduloNome, topicoNome }: UseLLMStreamOptions) {
  const [resposta, setResposta] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = useCallback(
    async (pergunta: string) => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setErro("Faça login para usar o chat.");
        return;
      }

      setResposta("");
      setErro(null);
      setStreaming(true);

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
          }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setErro((data as { detail?: string }).detail ?? "Erro ao conectar com a IA.");
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

          // SSE events são separados por \n\n
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
                setResposta((prev) => prev + json.token);
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
      } finally {
        setStreaming(false);
      }
    },
    [moduloNome, topicoNome]
  );

  const limpar = useCallback(() => {
    setResposta("");
    setErro(null);
  }, []);

  return { resposta, streaming, erro, enviar, limpar };
}
