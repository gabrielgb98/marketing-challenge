"use client";
import { useState } from "react";
import Link from "next/link";
export default function Home() {
  const [c, set] = useState("");
  return (
    <main>
      <header>
        ⚡ CLASSRUSH <span>APRENDER. COMPETIR. CONECTAR.</span>
      </header>
      <section className="center">
        <div className="pill">Tu clase, en modo desafío</div>
        <h1>
          El conocimiento
          <br />
          <em>enciende el juego.</em>
        </h1>
        <p>Un equipo. Un dispositivo. Todas las ganas de ganar.</p>
        <article>
          <label htmlFor="code">Ingresá el código de tu partida</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000000"
            value={c}
            maxLength={6}
            onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
          />
          <button
            disabled={c.length !== 6}
            onClick={() => location.assign("/jugar/" + c)}
          >
            Entrar al juego →
          </button>
        </article>
        <Link className="btn muted" href="/docente">
          Soy docente · Ir a mi biblioteca
        </Link>
        <p className="small">
          Los estudiantes participan sin crear una cuenta.
        </p>
      </section>
    </main>
  );
}
