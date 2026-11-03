"use client";
import { useEffect, useRef, useState } from "react";
import { db, download, csvCell, type Question } from "./classrush";
type State = {
  code: string;
  title: string;
  status: string;
  joinOnly?: boolean;
  idx: number;
  total: number;
  started_at: string;
  server_now: string;
  question: Question | null;
  ranking: { id: string; name: string; points: number }[];
  answer: { choice: number; points: number | null } | null;
  received: number;
};
type Credential = { id: string; secret: string };
export default function Arena({
  code,
  host = false,
}: {
  code: string;
  host?: boolean;
}) {
  const api = db(),
    [g, G] = useState<State | null>(null),
    [name, N] = useState(""),
    [err, E] = useState(""),
    [busy, B] = useState(false),
    [now, Now] = useState(Date.now()),
    [credential, C] = useState<Credential | null>(null),
    [auth, Auth] = useState(!host),
    offset = useRef(0),
    sent = useRef(false),
    latest = useRef(0);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cr_team_" + code);
      if (stored) C(JSON.parse(stored));
    } catch {
      E(
        "No se pudo recuperar el equipo. Habilitá el almacenamiento del navegador.",
      );
    }
    if (host && api) api.auth.getUser().then(({ data }) => Auth(!!data.user));
  }, [api, code, host]);
  async function refresh() {
    if (!api) return;
    const request = ++latest.current;
    const r = await api.rpc("cr_state", {
      c: code,
      tid: credential?.id || null,
      secret: credential?.secret || null,
    });
    if (request !== latest.current) return;
    if (r.error) {
      E(r.error.message);
      return;
    }
    if (r.data.server_now)
      offset.current = new Date(r.data.server_now).getTime() - Date.now();
    G(r.data);
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500),
      n = setInterval(() => Now(Date.now()), 200);
    return () => {
      clearInterval(t);
      clearInterval(n);
      latest.current++;
    };
  }, [api, code, credential]);
  useEffect(() => {
    sent.current = false;
  }, [g?.idx]);
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    B(true);
    E("");
    try {
      await fn();
    } catch (e) {
      E(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      B(false);
    }
  }
  async function join() {
    if (!api) throw Error("Falta configurar el entorno de pruebas");
    const secret = crypto.randomUUID() + crypto.randomUUID();
    const r = await api.rpc("cr_join", { c: code, n: name.trim(), secret });
    if (r.error) throw r.error;
    const cred = { id: r.data, secret };
    localStorage.setItem("cr_team_" + code, JSON.stringify(cred));
    C(cred);
  }
  async function submit(a: number) {
    if (!api || !g || !credential || sent.current) return;
    sent.current = true;
    const r = await api.rpc("cr_submit", {
      c: code,
      tid: credential.id,
      secret: credential.secret,
      i: g.idx,
      a,
    });
    if (r.error) {
      sent.current = false;
      throw r.error;
    }
    await refresh();
  }
  const q = g?.question,
    left =
      q && g?.started_at
        ? Math.max(
            0,
            Math.ceil(
              q.seconds -
                (now + offset.current - new Date(g.started_at).getTime()) /
                  1000,
            ),
          )
        : 0;
  return (
    <main className={host ? "wide" : ""}>
      <header>
        ⚡ CLASSRUSH{" "}
        <a href={host ? "/docente" : "/"}>{host ? "Biblioteca" : "Inicio"}</a>
      </header>
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      {!api ? (
        <article>
          <h2>Entorno de pruebas sin configurar</h2>
          <p>Esta versión necesita un proyecto Supabase independiente.</p>
        </article>
      ) : host && !auth ? (
        <article>
          <h2>Ingresá con tu cuenta docente</h2>
          <a className="btn" href="/docente">
            Iniciar sesión
          </a>
        </article>
      ) : !g ? (
        <p>Buscando partida {code}…</p>
      ) : g.joinOnly ? (
        host ? (
          <article>
            <h2>No tenés acceso a esta partida</h2>
            <a href="/docente">Volver al panel</a>
          </article>
        ) : (
          <article>
            <div className="pill">Partida {code}</div>
            <h1>Tu equipo entra en juego.</h1>
            <p>{g.title} · Un dispositivo por equipo</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(join);
              }}
            >
              <label htmlFor="team-name">Nombre del equipo</label>
              <input
                id="team-name"
                required
                minLength={2}
                maxLength={30}
                autoComplete="off"
                value={name}
                onChange={(e) => N(e.target.value)}
              />
              <button disabled={busy || g.status !== "lobby"}>
                {g.status === "lobby" ? "Sumarnos →" : "La partida ya comenzó"}
              </button>
            </form>
          </article>
        )
      ) : (
        <>
          <div className="row">
            <div>
              <div className="pill">{g.title}</div>
              <h1>
                {g.status === "finished"
                  ? "¡Tenemos podio!"
                  : g.status === "lobby"
                    ? "La clase está por encenderse."
                    : `Pregunta ${g.idx + 1} de ${g.total}`}
              </h1>
            </div>
            {host && (
              <div className="center">
                <small>CÓDIGO</small>
                <div className="code">{code}</div>
              </div>
            )}
          </div>
          {g.status === "lobby" ? (
            <article className="center">
              <div className="emoji">⚡</div>
              <h2>
                {host
                  ? `${g.ranking.length} equipos en la sala`
                  : "¡Tu equipo está listo!"}
              </h2>
              <p>
                {host
                  ? `Ingresen a ${typeof location !== "undefined" ? location.origin : ""} y escriban el código.`
                  : "Esperen a que el docente comience."}
              </p>
            </article>
          ) : g.status !== "finished" && q ? (
            <article>
              <div className="row">
                <div className="pill">
                  {q.double
                    ? "🔥 PUNTOS DOBLES"
                    : `${q.points} PUNTOS + VELOCIDAD`}
                </div>
                <strong className="timer">{left}s</strong>
              </div>
              <h2 className="question">{q.text}</h2>
              <div className="choices">
                {q.options.map((o, i) => (
                  <button
                    key={i}
                    className={
                      "choice " +
                      (g.status === "reveal" && q.correct === i
                        ? "correct"
                        : "")
                    }
                    disabled={
                      host ||
                      busy ||
                      !!g.answer ||
                      left === 0 ||
                      g.status !== "question" ||
                      sent.current
                    }
                    onClick={() => act(() => submit(i))}
                  >
                    <strong>{"ABCD"[i]}</strong> {o}
                  </button>
                ))}
              </div>
              {g.status === "reveal" ? (
                <p className="notice">
                  Correcta: {"ABCD"[q.correct]} · {q.options[q.correct]}{" "}
                  {g.answer
                    ? ` · Tu equipo sumó ${g.answer.points} puntos`
                    : ""}
                </p>
              ) : host ? (
                <p>{g.received} respuestas recibidas</p>
              ) : g.answer ? (
                <p role="status">
                  Respuesta registrada. ¡Esperá la revelación!
                </p>
              ) : left === 0 ? (
                <p>Tiempo agotado. Esperá al docente.</p>
              ) : (
                <p>Debatan y elijan una respuesta.</p>
              )}
            </article>
          ) : null}
          {host && g.status !== "finished" && (
            <button
              disabled={busy || (g.status === "lobby" && !g.ranking.length)}
              onClick={() =>
                act(async () => {
                  const r = await api.rpc("cr_advance", { c: code });
                  if (r.error) throw r.error;
                  await refresh();
                })
              }
            >
              {g.status === "lobby"
                ? "Comenzar competencia →"
                : g.status === "question"
                  ? "Cerrar pregunta y revelar respuesta"
                  : g.idx === g.total - 1
                    ? "Ver podio final 🏆"
                    : "Siguiente pregunta →"}
            </button>
          )}
          <article>
            <h2>
              {g.status === "finished"
                ? "🏆 Podio y clasificación"
                : "Ranking en vivo"}
            </h2>
            {g.status === "question" && (
              <p className="small">
                Los puntos de esta pregunta aparecen al revelar la respuesta.
              </p>
            )}
            {g.ranking.map((t, i) => (
              <div
                className={"rank " + (t.id === credential?.id ? "mine" : "")}
                key={t.id}
              >
                <span>
                  {["🥇", "🥈", "🥉"][i] || i + 1} {t.name}
                </span>
                <b>{t.points} pts</b>
              </div>
            ))}
          </article>
          {host && (
            <button
              className="muted"
              onClick={() =>
                download(
                  `ClassRush-${code}.csv`,
                  [
                    ["Posición", "Equipo", "Puntos", "Partida"],
                    ...g.ranking.map((t, i) => [i + 1, t.name, t.points, code]),
                  ]
                    .map((r) => r.map(csvCell).join(","))
                    .join("\r\n"),
                )
              }
            >
              Exportar ranking CSV
            </button>
          )}
        </>
      )}
    </main>
  );
}
