"use client";

import { useState } from "react";
import { CriarConcursoPayload, Concurso } from "@/hooks/useConcursos";

interface Props {
  onClose: () => void;
  onCriado: (concurso: Concurso) => void;
  criar: (payload: CriarConcursoPayload) => Promise<Concurso>;
}

const AREA_OPTIONS = [
  { value: "federal", label: "Federal" },
  { value: "estadual", label: "Estadual" },
  { value: "municipal", label: "Municipal" },
  { value: "militar", label: "Militar" },
] as const;

export function CriarConcursoModal({ onClose, onCriado, criar }: Props) {
  const [orgao, setOrgao] = useState("");
  const [cargo, setCargo] = useState("");
  const [area, setArea] = useState<CriarConcursoPayload["area"]>("federal");
  const [bancaNome, setBancaNome] = useState("");
  const [editalUrl, setEditalUrl] = useState("");
  const [editalTexto, setEditalTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const charCount = editalTexto.length;
  const podeSalvar = orgao.trim() && cargo.trim() && editalTexto.trim().length >= 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeSalvar || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const concurso = await criar({
        orgao: orgao.trim(),
        cargo: cargo.trim(),
        area,
        banca_nome: bancaNome.trim() || undefined,
        edital_texto: editalTexto,
        edital_url: editalUrl.trim() || undefined,
      });
      onCriado(concurso);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar concurso.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Adicionar meu concurso</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Cole o texto do edital e a IA vai montar sua trilha de estudos.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Órgão + Cargo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Órgão <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={orgao}
                onChange={(e) => setOrgao(e.target.value)}
                placeholder="Ex: IFSP, DATAPREV, Prefeitura de SP"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ex: Analista de TI, Auditor Fiscal"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
          </div>

          {/* Área + Banca */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Área <span className="text-red-500">*</span>
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value as CriarConcursoPayload["area"])}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {AREA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banca <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={bancaNome}
                onChange={(e) => setBancaNome(e.target.value)}
                placeholder="Ex: CESPE, FCC, VUNESP"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* URL do edital */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link do edital <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="url"
              value={editalUrl}
              onChange={(e) => setEditalUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Texto do edital */}
          <div className="flex-1">
            <div className="flex items-baseline justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Texto do edital <span className="text-red-500">*</span>
              </label>
              <span className={`text-xs ${charCount < 100 ? "text-gray-400" : "text-green-600"}`}>
                {charCount.toLocaleString("pt-BR")} caracteres
                {charCount < 100 && " (mínimo 100)"}
              </span>
            </div>
            <textarea
              value={editalTexto}
              onChange={(e) => setEditalTexto(e.target.value)}
              rows={12}
              placeholder={`Cole aqui o texto do edital.\n\nDica: abra o PDF do edital, selecione tudo (Ctrl+A), copie e cole aqui. Quanto mais completo o texto, melhor será a trilha gerada pela IA.`}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              💡 Não tem o texto? Abra o PDF, pressione Ctrl+A → Ctrl+C e cole aqui.
            </p>
          </div>

          {/* Erro */}
          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <span className="shrink-0">⚠️</span>
              <span>{erro}</span>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!podeSalvar || salvando}
            className={`text-sm text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 ${
              podeSalvar && !salvando
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-300 cursor-not-allowed"
            }`}
          >
            {salvando ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Salvando…
              </>
            ) : (
              "✨ Criar e gerar trilha"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
