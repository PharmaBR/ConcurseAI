"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface User {
  id: string;
  email: string;
  username: string;
  plano: "gratuito" | "candidato" | "anual";
  creditos_llm: number;
  editais_monitorados: number;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  erro: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: false,
    erro: null,
  });

  async function login(email: string, password: string): Promise<void> {
    setState((s) => ({ ...s, loading: true, erro: null }));
    try {
      const res = await fetch(`${API_URL}/api/auth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Credenciais inválidas.");
      }

      const { access, refresh } = await res.json();
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);

      // Busca dados do usuário logado
      const meRes = await fetch(`${API_URL}/api/users/me/`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      const user = await meRes.json();
      setState({ user, loading: false, erro: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login.";
      setState((s) => ({ ...s, loading: false, erro: message }));
      throw err;
    }
  }

  async function register(
    email: string,
    username: string,
    password: string
  ): Promise<void> {
    setState((s) => ({ ...s, loading: true, erro: null }));
    try {
      const res = await fetch(`${API_URL}/api/users/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        const msg = Object.values(data).flat().join(" ");
        throw new Error(msg || "Erro ao criar conta.");
      }

      // Após registrar, faz login automaticamente
      await login(email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao registrar.";
      setState((s) => ({ ...s, loading: false, erro: message }));
      throw err;
    }
  }

  function logout(): void {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setState({ user: null, loading: false, erro: null });
  }

  return { ...state, login, register, logout };
}
