"use client";
import { useState } from "react";
import Link from "next/link";


export default function Home() {
  const [code, setCode] = useState("");
  return (
    <main className="home">
      <header className="home-nav">
        <Link className="brand" href="/">⚡ ClassRush</Link>
        <Link className="btn muted compact" href="/docente">Espacio docente <span aria-hidden="true">↗</span></Link>
      </header>
      <section className="home-content">
        <div>
          <h1>Tu clase,<br /><em>en juego.</em></h1>
          <p>Competí por equipos en cuestionarios en vivo. Un dispositivo por grupo.</p>
        </div>
        <article className="entry-card">
          <h2>Unirse a una partida</h2>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (code.length === 6) location.assign("/jugar/" + code);
          }}>
            <label htmlFor="code">Código de 6 dígitos</label>
            <input
              id="code"
              className="entry-code"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000000"
              value={code}
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
            <button disabled={code.length !== 6}>Entrar a la partida →</button>
          </form>
        </article>
      </section>
    </main>
  );
}
