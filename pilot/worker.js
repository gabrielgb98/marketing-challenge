import { validate } from "../lib/classrush.ts";
import { assets } from "./generated-assets.mjs";

const encoder = new TextEncoder();
const sessionCookie = "__Host-cr_session";
const sessionSeconds = 7 * 24 * 60 * 60;
const codePattern = /^\d{6}$/;
const idPattern = /^[\da-f-]{36}$/i;

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function text(value, max, min = 0) {
  const clean = typeof value === "string" ? value.trim() : "";
  if (clean.length < min || clean.length > max) throw new RequestError("Revisá los campos del formulario.");
  return clean;
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digest(value) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 600000,
  }, key, 256));
}

function equalHash(left, right) {
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0 && left.length === right.length;
}

const sessionHeader = (value, seconds) => sessionCookie + "=" + value + "; Path=/; Max-Age=" + seconds + "; HttpOnly; Secure; SameSite=Lax";
const publicTeacher = ({ id, email }) => ({ id, email });
const sql = (db, query, ...values) => db.prepare(query).bind(...values);
const utc = () => new Date().toISOString();

async function getSession(request, db) {
  const cookie = request.headers.get("Cookie")?.split(/;\s*/).find((item) => item.startsWith(sessionCookie + "="));
  if (!cookie) return null;
  const token = cookie.slice(sessionCookie.length + 1);
  if (!/^[\da-f]{64}$/.test(token)) return null;
  const hash = await digest(token);
  return sql(db, `SELECT teachers.id, teachers.email, teachers.name, sessions.token_hash
    FROM sessions JOIN teachers ON teachers.id = sessions.teacher_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`, hash, Date.now()).first();
}

function json(data, cookie) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (cookie) headers["Set-Cookie"] = cookie;
  return Response.json({ data }, { headers });
}

async function signIn(db, args, create, session) {
  const email = text(args.email, 254, 3).toLowerCase();
  const password = args.password;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || typeof password !== "string" || password.length < 10 || password.length > 128) {
    throw new RequestError("Ingresá un correo válido y una contraseña de 10 a 128 caracteres.");
  }
  const salt = crypto.randomUUID();
  let teacher;
  if (create) {
    teacher = { id: crypto.randomUUID(), email, name: text(args.name, 100, 1) };
    const hash = await passwordHash(password, salt);
    const result = await sql(db, "INSERT OR IGNORE INTO teachers VALUES (?, ?, ?, ?, ?)", teacher.id, email, teacher.name, salt, hash).run();
    if (!result.meta.changes) throw new RequestError("Ya existe una cuenta con ese correo.");
  } else {
    teacher = await sql(db, "SELECT * FROM teachers WHERE email = ?", email).first();
    const hash = await passwordHash(password, teacher?.salt ?? salt);
    if (!teacher || !equalHash(hash, teacher.password_hash)) throw new RequestError("Correo o contraseña incorrectos.", 401);
  }
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const statements = [
    sql(db, "DELETE FROM sessions WHERE expires_at <= ?", Date.now()),
    sql(db, "INSERT INTO sessions VALUES (?, ?, ?)", await digest(token), teacher.id, Date.now() + 1000 * sessionSeconds),
  ];
  if (session) statements.push(sql(db, "DELETE FROM sessions WHERE token_hash = ?", session.token_hash));
  await db.batch(statements);
  return json({ user: publicTeacher(teacher) }, sessionHeader(token, sessionSeconds));
}

function quizDraft(quiz) {
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length < 1 || quiz.questions.length > 100) {
    throw new RequestError("Agregá entre 1 y 100 preguntas.");
  }
  const questions = quiz.questions.map((q) => {
    if (!q || typeof q.text !== "string" || !Array.isArray(q.options) ||
        q.options.some((option) => typeof option !== "string") || typeof q.double !== "boolean" || validate(q).length) {
      throw new RequestError("Revisá el contenido de las preguntas.");
    }
    return { text: q.text.trim(), options: q.options.map((option) => option.trim()), correct: q.correct, seconds: q.seconds, points: q.points, double: q.double };
  });
  return [text(quiz.title, 150, 1), text(quiz.subject, 150), text(quiz.description, 2000), JSON.stringify(questions)];
}

async function library(db, teacher) {
  const [quizzes, games] = await db.batch([
    sql(db, "SELECT id,title,subject,description,questions FROM quizzes WHERE teacher_id = ? AND archived = 0 ORDER BY created_at DESC", teacher.id),
    sql(db, "SELECT code,title,status,created_at FROM games WHERE teacher_id = ? ORDER BY created_at DESC", teacher.id),
  ]);
  return { name: teacher.name, games: games.results, quizzes: quizzes.results.map((quiz) => ({ ...quiz, questions: JSON.parse(quiz.questions) })) };
}

async function createGame(db, teacher, quizId) {
  const quiz = await sql(db, "SELECT title,questions FROM quizzes WHERE id = ? AND teacher_id = ? AND archived = 0", quizId, teacher.id).first();
  if (!quiz) throw new RequestError("Cuestionario no disponible.", 404);
  for (let i = 0; i < 20; i++) {
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    if (code === "224062") continue;
    const result = await sql(db, "INSERT OR IGNORE INTO games (code,teacher_id,title,questions,created_at) VALUES (?,?,?,?,?)",
      code, teacher.id, quiz.title, quiz.questions, utc()).run();
    if (result.meta.changes) return code;
  }
  throw new RequestError("Volvé a intentar crear la partida.", 503);
}

async function gameState(db, code, args, teacher) {
  const hash = typeof args.secret === "string" && args.secret.length <= 200 ? await digest(args.secret) : "";
  const [gameResult, teamResult, rankingResult, answerResult, countResult] = await db.batch([
    sql(db, "SELECT * FROM games WHERE code = ?", code),
    sql(db, "SELECT id FROM teams WHERE code = ? AND id = ? AND secret_hash = ?", code, typeof args.tid === "string" ? args.tid : "", hash),
    sql(db, `SELECT t.id,t.name,COALESCE(SUM(CASE WHEN g.status IN ('reveal','finished') OR a.idx < g.idx THEN a.points END),0) AS points
      FROM games g JOIN teams t ON t.code = g.code LEFT JOIN answers a ON a.team_id = t.id
      WHERE g.code = ? GROUP BY t.id,t.name ORDER BY points DESC,t.name`, code),
    sql(db, `SELECT a.choice, CASE WHEN g.status IN ('reveal','finished') THEN a.points END AS points
      FROM games g JOIN teams t ON t.code = g.code JOIN answers a ON a.team_id = t.id AND a.idx = g.idx
      WHERE g.code = ? AND t.id = ? AND t.secret_hash = ?`, code, typeof args.tid === "string" ? args.tid : "", hash),
    sql(db, `SELECT COUNT(*) AS received FROM answers a JOIN teams t ON t.id = a.team_id JOIN games g ON g.code = t.code
      WHERE g.code = ? AND a.idx = g.idx`, code),
  ]);
  const game = gameResult.results[0];
  if (!game) throw new RequestError("Partida no encontrada. Revisá el código.", 404);
  const { title, status, idx } = game;
  const owner = teacher?.id === game.teacher_id;
  if (!owner && !teamResult.results.length) return { code, title, status, joinOnly: true };
  const questions = JSON.parse(game.questions);
  const question = status === "question" || status === "reveal" ? questions[idx] : null;
  if (question && status === "question") delete question.correct;
  return {
    code, title, status, idx, total: questions.length,
    started_at: game.started_at === null ? null : new Date(game.started_at).toISOString(),
    server_now: utc(), question, ranking: rankingResult.results, answer: answerResult.results[0] ?? null,
    received: owner ? countResult.results[0].received : null,
  };
}

async function joinGame(db, code, args) {
  const name = text(args.n, 30, 2);
  const hash = await digest(text(args.secret, 200, 32));
  const id = crypto.randomUUID();
  const result = await sql(db, `INSERT OR IGNORE INTO teams (id,code,name,name_key,secret_hash)
    SELECT ?,code,?,?,? FROM games WHERE code = ? AND status = 'lobby'
    AND (SELECT COUNT(*) FROM teams WHERE code = games.code) < 30`,
    id, name, name.normalize("NFKC").toLocaleLowerCase("es"), hash, code).run();
  if (result.meta.changes) return id;
  const existing = await sql(db, "SELECT id FROM teams WHERE code = ? AND secret_hash = ?", code, hash).first();
  if (existing) return existing.id;
  const game = await sql(db, "SELECT status,(SELECT COUNT(*) FROM teams WHERE code = ?) AS total FROM games WHERE code = ?", code, code).first();
  if (game?.status !== "lobby") throw new RequestError("El ingreso a la partida está cerrado.", 409);
  if (game.total >= 30) throw new RequestError("La partida alcanzó el máximo de 30 equipos.", 409);
  throw new RequestError("Ese nombre ya está registrado. Elegí otro para tu equipo.", 409);
}

async function advanceGame(db, code, args, teacher) {
  const game = await sql(db, `SELECT status,idx,json_array_length(questions) AS total,
    (SELECT COUNT(*) FROM teams WHERE code = ?) AS teams FROM games WHERE code = ? AND teacher_id = ?`, code, code, teacher.id).first();
  if (!game) throw new RequestError("No tenés acceso a esta partida.", 403);
  if (game.status !== args.expected_status || game.idx !== args.expected_idx) return;
  if (game.status === "finished") return;
  if (game.status === "lobby" && !game.teams) throw new RequestError("Esperá al menos un equipo.");
  const status = game.status === "question" ? "reveal"
    : game.status === "reveal" && game.idx === game.total - 1 ? "finished" : "question";
  const idx = game.status === "reveal" && status === "question" ? game.idx + 1 : game.idx;
  await sql(db, `UPDATE games SET status = ?, idx = ?, started_at = CASE WHEN ? = 'question' THEN ? ELSE started_at END
    WHERE code = ? AND teacher_id = ? AND status = ? AND idx = ?`,
    status, idx, status, Date.now(), code, teacher.id, game.status, game.idx).run();
}

async function submitAnswer(db, code, args) {
  const { i, a, tid, secret } = args;
  if (!Number.isInteger(i) || i < 0 || i >= 100 || !Number.isInteger(a) || a < 0 || a > 3 || typeof tid !== "string" || !idPattern.test(tid)) {
    throw new RequestError("Respuesta inválida.");
  }
  const hash = await digest(text(secret, 200, 32));
  const questionPath = "$[" + i + "]";
  const game = await sql(db, `SELECT g.status,g.idx,g.started_at,json_extract(g.questions,?) AS question
    FROM games g JOIN teams t ON t.code = g.code WHERE g.code = ? AND t.id = ? AND t.secret_hash = ?`,
    questionPath, code, tid, hash).first();
  if (!game) throw new RequestError("Equipo inválido.", 403);
  if (game.status !== "question" || game.idx !== i) throw new RequestError("La pregunta ya está cerrada.", 409);
  const question = JSON.parse(game.question);
  const elapsed = Math.max(0, Date.now() - game.started_at);
  const duration = question.seconds * 1000;
  if (elapsed >= duration) throw new RequestError("Tiempo agotado.", 409);
  const points = a === question.correct
    ? Math.round(question.points * (1 + 0.5 * (1 - elapsed / duration))) * (question.double ? 2 : 1) : 0;
  const result = await sql(db, `INSERT OR IGNORE INTO answers (team_id,idx,choice,points)
    SELECT ?,?,?,? FROM games WHERE code = ? AND status = 'question' AND idx = ? AND started_at = ?
    AND unixepoch('subsec') * 1000 < ?`, tid, i, a, points, code, i, game.started_at, game.started_at + duration).run();
  if (!result.meta.changes) {
    const existing = await sql(db, "SELECT choice FROM answers WHERE team_id = ? AND idx = ?", tid, i).first();
    if (existing?.choice === a) return;
    throw new RequestError(existing ? "El equipo ya respondió." : "La pregunta ya está cerrada.", 409);
  }
}

async function api(request, env, action) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (request.headers.get("Sec-Fetch-Site") === "cross-site" || !request.headers.get("Content-Type")?.startsWith("application/json")) {
    throw new RequestError("Solicitud inválida.", 403);
  }
  const body = await request.text();
  if (body.length > 800000) throw new RequestError("La solicitud supera el tamaño permitido.", 413);
  let args;
  try { args = JSON.parse(body); } catch { throw new RequestError("Solicitud inválida."); }
  if (!args || Array.isArray(args) || typeof args !== "object") throw new RequestError("Solicitud inválida.");
  const db = env.DB;
  const teacher = await getSession(request, db);
  const code = typeof args.c === "string" ? args.c : "";
  if (["game-state", "game-join", "game-submit", "game-advance"].includes(action) && !codePattern.test(code)) {
    throw new RequestError("Ingresá un código de 6 dígitos.");
  }
  switch (action) {
    case "user": return json(teacher ? publicTeacher(teacher) : null);
    case "login": return signIn(db, args, false, teacher);
    case "register": return signIn(db, args, true, teacher);
    case "logout":
      if (teacher) await sql(db, "DELETE FROM sessions WHERE token_hash = ?", teacher.token_hash).run();
      return json(null, sessionHeader("", 0));
    case "game-state": return json(await gameState(db, code, args, teacher));
    case "game-join": return json(await joinGame(db, code, args));
    case "game-submit":
      await submitAnswer(db, code, args);
      return json(null);
  }
  if (!teacher) throw new RequestError("Ingresá con tu cuenta docente.", 401);
  switch (action) {
    case "library": return json(await library(db, teacher));
    case "profile":
      await sql(db, "UPDATE teachers SET name = ? WHERE id = ?", text(args.name, 100, 1), teacher.id).run();
      return json(null);
    case "save-quiz": {
      const values = quizDraft(args.quiz);
      if (!args.id) {
        await sql(db, `INSERT INTO quizzes (id,teacher_id,title,subject,description,questions,created_at)
          VALUES (?,?,?,?,?,?,?)`, crypto.randomUUID(), teacher.id, ...values, utc()).run();
      } else {
        const result = await sql(db, `UPDATE quizzes SET title = ?,subject = ?,description = ?,questions = ?
          WHERE id = ? AND teacher_id = ? AND archived = 0`, ...values, text(args.id, 36, 36), teacher.id).run();
        if (!result.meta.changes) throw new RequestError("Cuestionario no disponible.", 404);
      }
      return json(null);
    }
    case "archive-quiz":
      await sql(db, "UPDATE quizzes SET archived = 1 WHERE id = ? AND teacher_id = ?", text(args.id, 36, 36), teacher.id).run();
      return json(null);
    case "game-create": return json(await createGame(db, teacher, text(args.quiz, 36, 36)));
    case "game-advance":
      await advanceGame(db, code, args, teacher);
      return json(null);
    default: throw new RequestError("Acción no disponible.", 404);
  }
}

function staticResponse(request, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
  let path;
  try {
    path = decodeURIComponent(pathname).replace(/\/$/, "") || "/";
  } catch {
    return new Response("Página no encontrada", { status: 404 });
  }
  const shell = path.replace(/^\/(jugar|partida)\/\d{6}$/, "/$1/000000");
  const entry = Object.hasOwn(assets, shell) ? assets[shell] : null;
  if (!entry) return new Response("Página no encontrada", { status: 404 });
  const [type, body] = entry;
  return new Response(request.method === "HEAD" ? null : Uint8Array.from(atob(body), (character) => character.charCodeAt(0)), {
    headers: {
      "Content-Type": type,
      "Cache-Control": shell.startsWith("/_next/") ? "private, max-age=31536000, immutable" : "private, no-cache",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith("/api/pilot/")) return staticResponse(request, pathname);
    try {
      return await api(request, env, pathname.slice("/api/pilot/".length));
    } catch (error) {
      if (!(error instanceof RequestError)) console.error("ClassRush pilot error", error instanceof Error ? error.message : String(error));
      return Response.json({ error: error instanceof RequestError ? error.message : "Ocurrió un error en la prueba privada." }, {
        status: error instanceof RequestError ? error.status : 500,
        headers: { "Cache-Control": "no-store" },
      });
    }
  },
};
