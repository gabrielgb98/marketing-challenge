"use client";
import { useState } from "react";
import { db } from "@/lib/api";
export default function Reset() {
  const [p, P] = useState(""),
    [msg, M] = useState("");
  return (
    <main>
      <header>⚡ CLASSRUSH</header>
      <h1>Nueva contraseña</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const api = db();
          if (!api) return M("Configuración de pruebas pendiente");
          try {
            await api.updatePassword(p);
            M("Contraseña actualizada. Ya podés ingresar.");
          } catch (error) {
            M(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
          }
        }}
      >
        <label htmlFor="password">Contraseña (mínimo 10 caracteres)</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          value={p}
          onChange={(e) => P(e.target.value)}
        />
        <button>Guardar contraseña</button>
      </form>
      <p role="status">{msg}</p>
      <a href="/docente">Volver al panel</a>
    </main>
  );
}
