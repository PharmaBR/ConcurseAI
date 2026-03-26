"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Lê o token e busca dados do usuário logado
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setReady(true);
      return;
    }

    fetch(`${API_URL}/api/users/me/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((user) => {
        if (user) setEmail(user.email);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [pathname]); // Re-executa ao navegar (ex: logo após login)

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setEmail(null);
    router.push("/");
    router.refresh();
  }

  // Não renderiza nada até confirmar o estado (evita flash)
  if (!ready) return <nav className="h-12 border-b bg-white" />;

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="font-bold text-blue-600 hover:text-blue-700">
          ConcurseAI
        </a>

        {/* Auth */}
        <div className="flex items-center gap-3 text-sm">
          {email ? (
            <>
              <span className="text-gray-500 hidden sm:block truncate max-w-[180px]">
                {email}
              </span>
              <button
                onClick={handleLogout}
                className="border rounded px-3 py-1 text-gray-600 hover:bg-gray-50"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <a
                href="/login"
                className="text-gray-600 hover:text-gray-900"
              >
                Entrar
              </a>
              <a
                href="/register"
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Criar conta
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
