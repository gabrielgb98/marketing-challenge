"use client";
import { useEffect, useState } from "react";
import {
  db,
  blank,
  validate,
  download,
  csvCell,
  parseCSV,
  importRows,
  headers,
  type Quiz,
  type Question,
} from "@/lib/classrush";
import type { User } from "@supabase/supabase-js";
export default function Teacher() {
  const api = db();
  const [user, U] = useState<User | null>(null),
    [ready, R] = useState(false),
    [email, EM] = useState(""),
    [password, PW] = useState(""),
    [name, N] = useState(""),
    [mode, M] = useState("login"),
    [msg, MSG] = useState(""),
    [busy, B] = useState(false);
  const [quizzes, Q] = useState<Quiz[]>([]),
    [edit, E] = useState<Partial<Quiz> | null>(null),
    [games, G] = useState<any[]>([]),
    [preview, PV] = useState<ReturnType<typeof importRows>>([]),
    [tab, T] = useState("library");
  async function load() {
    if (!api) return;
    const [a, b, p] = await Promise.all([
      api
        .from("cr_quizzes")
        .select("*")
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      api
        .from("cr_games")
        .select("code,title,status,created_at")
        .order("created_at", { ascending: false }),
      api.from("cr_profiles").select("name").maybeSingle(),
    ]);
    if (a.error || b.error)
      MSG(a.error?.message || b.error?.message || "Error");
    Q(a.data || []);
    G(b.data || []);
    if (p.data) N(p.data.name);
  }
  useEffect(() => {
    if (!api) {
      R(true);
      return;
    }
    api.auth.getUser().then(({ data }) => {
      U(data.user);
      R(true);
    });
    const { data } = api.auth.onAuthStateChange((_e, s) => U(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [api]);
  useEffect(() => {
    if (user) load();
  }, [user?.id]);
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    B(true);
    MSG("");
    try {
      await fn();
    } catch (e) {
      MSG(e instanceof Error ? e.message : "Ocurrió un error");
    } finally {
      B(false);
    }
  }
  async function auth() {
    if (!api) throw Error("Configurá el proyecto Supabase de pruebas");
    if (mode === "reset") {
      const { error } = await api.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + "/recuperar",
      });
      if (error) throw error;
      MSG("Si existe la cuenta, recibirás un correo de recuperación.");
      return;
    }
    const r =
      mode === "register"
        ? await api.auth.signUp({
            email,
            password,
            options: {
              data: { name },
              emailRedirectTo: location.origin + "/docente",
            },
          })
        : await api.auth.signInWithPassword({ email, password });
    if (r.error) throw r.error;
    MSG(
      mode === "register" ? "Revisá tu correo para confirmar el registro." : "",
    );
  }
  async function save() {
    if (!api || !edit) return;
    const questions = edit.questions || [];
    if (!edit.title?.trim()) throw Error("Ingresá un título");
    if (!questions.length || questions.length > 100)
      throw Error("Agregá entre 1 y 100 preguntas");
    for (const [q, i] of questions.map((q, i) => [q, i] as const)) {
      const errors = validate(q);
      if (errors.length) throw Error(`Pregunta ${i + 1}: ${errors.join(". ")}`);
    }
    const data = {
      title: edit.title.trim(),
      subject: edit.subject || "",
      description: edit.description || "",
      questions,
    };
    const r = edit.id
      ? await api.from("cr_quizzes").update(data).eq("id", edit.id)
      : await api.from("cr_quizzes").insert(data);
    if (r.error) throw r.error;
    E(null);
    PV([]);
    await load();
    MSG("Cuestionario guardado");
  }
  function updateQuestion(i: number, patch: Partial<Question>) {
    E((v) =>
      v
        ? {
            ...v,
            questions: v.questions?.map((q, j) =>
              j === i ? { ...q, ...patch } : q,
            ),
          }
        : v,
    );
  }
  async function readFile(file: File) {
    if (file.size > 2 * 1024 * 1024) throw Error("Máximo 2 MB");
    let rows: string[][];
    if (/\.csv$/i.test(file.name)) {
      rows = parseCSV(await file.text());
    } else if (/\.xlsx$/i.test(file.name)) {
      const { Workbook } = await import("exceljs");
      const w = new Workbook();
      await w.xlsx.load(await file.arrayBuffer());
      const sheet = w.worksheets[0];
      if (!sheet) throw Error("Archivo sin hojas");
      if (sheet.rowCount > 101) throw Error("Máximo 100 preguntas");
      rows = [];
      sheet.eachRow((r) => {
        const cells: string[] = [];
        for (let i = 1; i <= 9; i++) {
          const cell = r.getCell(i);
          if (cell.type === 6) throw Error("No se permiten fórmulas");
          cells.push(cell.text);
        }
        rows.push(cells);
      });
    } else throw Error("Seleccioná .csv o .xlsx");
    PV(importRows(rows));
  }
  async function exportGame(code: string) {
    if (!api) return;
    const r = await api.rpc("cr_state", { c: code });
    if (r.error) throw r.error;
    download(
      `ClassRush-${code}.csv`,
      [
        ["Posición", "Equipo", "Puntos", "Partida"],
        ...r.data.ranking.map((t: any, i: number) => [
          i + 1,
          t.name,
          t.points,
          code,
        ]),
      ]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n"),
    );
  }
  if (!ready)
    return (
      <main>
        <p>Cargando…</p>
      </main>
    );
  return (
    <main className="wide">
      <header>
        ⚡ CLASSRUSH <a href="/">Ingresar a una partida</a>
      </header>
      <div role="status" aria-live="polite">
        {msg && <p className="notice">{msg}</p>}
      </div>
      {!api && (
        <p className="notice">
          Entorno de pruebas sin configurar. Se requieren las variables
          CLASSRUSH de Supabase; la base de Marketing Challenge no se utiliza.
        </p>
      )}
      {!user ? (
        <section className="auth">
          <div className="pill">Espacio docente</div>
          <h1>
            {mode === "register"
              ? "Tu próxima gran clase."
              : mode === "reset"
                ? "Recuperá tu acceso."
                : "Bienvenido a tu próxima clase."}
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(auth);
            }}
          >
            {mode === "register" && (
              <>
                <label htmlFor="name">Tu nombre</label>
                <input
                  id="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => N(e.target.value)}
                />
              </>
            )}
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => EM(e.target.value)}
            />
            {mode !== "reset" && (
              <>
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={10}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => PW(e.target.value)}
                />
              </>
            )}
            <button disabled={busy || !api}>
              {mode === "register"
                ? "Crear mi cuenta"
                : mode === "reset"
                  ? "Enviar enlace"
                  : "Ingresar →"}
            </button>
          </form>
          <div className="row">
            <button
              className="muted"
              onClick={() => M(mode === "register" ? "login" : "register")}
            >
              {mode === "register" ? "Ya tengo cuenta" : "Crear cuenta"}
            </button>
            <button
              className="muted"
              onClick={() => M(mode === "reset" ? "login" : "reset")}
            >
              {mode === "reset" ? "Volver" : "Olvidé mi contraseña"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="row">
            <div>
              <div className="pill">ESPACIO DOCENTE</div>
              <h1>Clases que se viven.</h1>
              <p>{user.email}</p>
            </div>
            <button
              className="muted compact"
              onClick={() =>
                action(async () => {
                  await api?.auth.signOut();
                  E(null);
                  Q([]);
                  G([]);
                })
              }
            >
              Cerrar sesión
            </button>
          </div>
          <nav className="row">
            {[
              ["library", "Biblioteca"],
              ["history", "Historial"],
              ["profile", "Perfil"],
            ].map(([t, label]) => (
              <button
                key={t}
                className={tab === t ? "" : "muted"}
                onClick={() => T(t)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "profile" ? (
            <article>
              <h2>Tu perfil</h2>
              <label htmlFor="profile-name">Nombre</label>
              <input
                id="profile-name"
                maxLength={100}
                value={name}
                onChange={(e) => N(e.target.value)}
              />
              <button
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    if (!name.trim()) throw Error("Ingresá tu nombre");
                    const r = await api!
                      .from("cr_profiles")
                      .upsert({ id: user.id, name: name.trim() });
                    if (r.error) throw r.error;
                    MSG("Perfil guardado");
                  })
                }
              >
                Guardar perfil
              </button>
            </article>
          ) : tab === "history" ? (
            <>
              <h2>Tus partidas</h2>
              {!games.length && <p>Todavía no creaste partidas.</p>}
              {games.map((g) => (
                <article key={g.code}>
                  <div className="row">
                    <div>
                      <h2>{g.title}</h2>
                      <p>
                        {g.code} · {g.status} ·{" "}
                        {new Date(g.created_at).toLocaleDateString("es-PY")}
                      </p>
                    </div>
                    <a className="btn compact" href={"/partida/" + g.code}>
                      Abrir
                    </a>
                  </div>
                  <button
                    className="muted"
                    disabled={busy}
                    onClick={() => action(() => exportGame(g.code))}
                  >
                    Exportar ranking CSV
                  </button>
                </article>
              ))}
            </>
          ) : edit ? (
            <>
              <div className="row">
                <h2>
                  {edit.id ? "Editar cuestionario" : "Nuevo cuestionario"}
                </h2>
                <button
                  className="muted compact"
                  onClick={() => {
                    if (
                      confirm(
                        "¿Salir del editor? Se perderán los cambios sin guardar.",
                      )
                    ) {
                      E(null);
                      PV([]);
                    }
                  }}
                >
                  Volver
                </button>
              </div>
              <article>
                <label>
                  Título
                  <input
                    maxLength={150}
                    value={edit.title || ""}
                    onChange={(e) => E({ ...edit, title: e.target.value })}
                  />
                </label>
                <label>
                  Materia
                  <input
                    maxLength={150}
                    value={edit.subject || ""}
                    onChange={(e) => E({ ...edit, subject: e.target.value })}
                  />
                </label>
                <label>
                  Descripción
                  <textarea
                    maxLength={2000}
                    value={edit.description || ""}
                    onChange={(e) =>
                      E({ ...edit, description: e.target.value })
                    }
                  />
                </label>
              </article>
              <article>
                <h2>Importar preguntas</h2>
                <p>
                  Combiná preguntas manuales y de Excel o CSV. Revisá la vista
                  previa antes de incorporarlas.
                </p>
                <button
                  className="muted"
                  onClick={() =>
                    download(
                      "ClassRush-plantilla.csv",
                      headers.join(",") +
                        '\r\n"¿Cuánto es 2 + 2?",3,4,5,6,B,35,1000,no',
                    )
                  }
                >
                  Descargar plantilla CSV (compatible con Excel)
                </button>
                <label>
                  Archivo Excel (.xlsx) o CSV
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) action(() => readFile(file));
                      e.target.value = "";
                    }}
                  />
                </label>
                {preview.length > 0 && (
                  <>
                    <p>
                      {preview.length} preguntas ·{" "}
                      {preview.filter((p) => p.errors.length).length} filas con
                      errores
                    </p>
                    {preview.map((p) => (
                      <div className="option" key={p.row}>
                        <b>
                          Fila {p.row}: {p.q.text}
                        </b>
                        <p>
                          {p.q.options.join(" · ")} · Correcta:{" "}
                          {"ABCD"[p.q.correct] || "?"} · {p.q.seconds}s ·{" "}
                          {p.q.points} pts {p.q.double ? "×2" : ""}
                        </p>
                        {p.errors.length > 0 && (
                          <p className="error">{p.errors.join(". ")}</p>
                        )}
                      </div>
                    ))}
                    <button
                      disabled={
                        preview.some((p) => p.errors.length > 0) ||
                        (edit.questions?.length || 0) + preview.length > 100
                      }
                      onClick={() => {
                        E({
                          ...edit,
                          questions: [
                            ...(edit.questions || []),
                            ...preview.map((p) => p.q),
                          ],
                        });
                        PV([]);
                      }}
                    >
                      Aprobar e incorporar preguntas
                    </button>
                  </>
                )}
              </article>
              {edit.questions?.map((q, i) => (
                <article key={i}>
                  <div className="row">
                    <h2>Pregunta {i + 1}</h2>
                    <button
                      className="muted compact"
                      onClick={() =>
                        E({
                          ...edit,
                          questions: edit.questions?.filter((_, j) => i !== j),
                        })
                      }
                    >
                      Quitar
                    </button>
                  </div>
                  <label>
                    Enunciado
                    <textarea
                      maxLength={2000}
                      value={q.text}
                      onChange={(e) =>
                        updateQuestion(i, { text: e.target.value })
                      }
                    />
                  </label>
                  <div className="grid">
                    {q.options.map((o, j) => (
                      <label key={j}>
                        Opción {"ABCD"[j]}
                        <input
                          maxLength={500}
                          value={o}
                          onChange={(e) =>
                            updateQuestion(i, {
                              options: q.options.map((v, k) =>
                                k === j ? e.target.value : v,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <div className="grid">
                    <label>
                      Respuesta correcta
                      <select
                        value={q.correct}
                        onChange={(e) =>
                          updateQuestion(i, { correct: Number(e.target.value) })
                        }
                      >
                        {q.options.map((_, j) => (
                          <option key={j} value={j}>
                            {"ABCD"[j]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tiempo (segundos)
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={q.seconds}
                        onChange={(e) =>
                          updateQuestion(i, { seconds: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Puntos base
                      <input
                        type="number"
                        min={100}
                        max={10000}
                        value={q.points}
                        onChange={(e) =>
                          updateQuestion(i, { points: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={q.double}
                        onChange={(e) =>
                          updateQuestion(i, { double: e.target.checked })
                        }
                      />{" "}
                      Puntos dobles
                    </label>
                  </div>
                </article>
              ))}
              <div className="row sticky">
                <button
                  className="muted"
                  disabled={(edit.questions?.length || 0) >= 100}
                  onClick={() =>
                    E({
                      ...edit,
                      questions: [...(edit.questions || []), blank()],
                    })
                  }
                >
                  + Pregunta manual
                </button>
                <button disabled={busy} onClick={() => action(save)}>
                  Guardar cuestionario
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="row">
                <h2>
                  Mi biblioteca <small>({quizzes.length})</small>
                </h2>
                <button
                  className="compact"
                  onClick={() => {
                    E({
                      title: "",
                      subject: "",
                      description: "",
                      questions: [blank()],
                    });
                    PV([]);
                  }}
                >
                  + Crear cuestionario
                </button>
              </div>
              {!quizzes.length && (
                <article>
                  <h2>Todo empieza con una buena pregunta.</h2>
                  <p>
                    Creá tu primer cuestionario para cualquier materia. Podrás
                    usarlo en tantas clases como quieras.
                  </p>
                </article>
              )}
              <div className="grid">
                {quizzes.map((q) => (
                  <article key={q.id}>
                    <div className="pill">{q.subject || "Sin materia"}</div>
                    <h2>{q.title}</h2>
                    <p>{q.description}</p>
                    <p>
                      {q.questions.length} preguntas ·{" "}
                      {q.questions.filter((x) => x.double).length} de puntos
                      dobles
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          const r = await api!.rpc("cr_create_game", {
                            quiz: q.id,
                          });
                          if (r.error) throw r.error;
                          location.assign("/partida/" + r.data);
                        })
                      }
                    >
                      Iniciar partida →
                    </button>
                    <div className="row">
                      <button
                        className="muted"
                        onClick={() => {
                          E(structuredClone(q));
                          PV([]);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="muted"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            const r = await api!
                              .from("cr_quizzes")
                              .insert({
                                title: q.title.slice(0, 140) + " (copia)",
                                subject: q.subject,
                                description: q.description,
                                questions: q.questions,
                              });
                            if (r.error) throw r.error;
                            await load();
                          })
                        }
                      >
                        Duplicar
                      </button>
                    </div>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            "¿Eliminar de tu biblioteca? Las partidas y resultados se conservarán.",
                          )
                        )
                          action(async () => {
                            const r = await api!
                              .from("cr_quizzes")
                              .update({ archived: true })
                              .eq("id", q.id);
                            if (r.error) throw r.error;
                            await load();
                          });
                      }}
                    >
                      Eliminar de mi biblioteca
                    </button>
                  </article>
                ))}
              </div>
              <article>
                <h2>Generación con IA · Próxima fase</h2>
                <p>
                  La generación desde texto, PDF y PowerPoint todavía no está
                  habilitada. Primero validaremos el flujo de juego y los
                  permisos con docentes reales.
                </p>
              </article>
            </>
          )}
        </>
      )}
    </main>
  );
}
