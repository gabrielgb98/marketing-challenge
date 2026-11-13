export type Question = {
  text: string;
  options: string[];
  correct: number;
  seconds: number;
  points: number;
  double: boolean;
};
export type Quiz = {
  id: string;
  title: string;
  subject: string;
  description: string;
  questions: Question[];
};
export type GameStatus = "lobby" | "question" | "reveal" | "finished";
export type GameSummary = {
  code: string;
  title: string;
  status: GameStatus;
  created_at: string;
};
export type GameState = {
  code: string;
  title: string;
  status: GameStatus;
  joinOnly?: boolean;
  idx: number;
  total: number;
  started_at: string | null;
  server_now?: string;
  question: (Omit<Question, "correct"> & { correct?: number }) | null;
  ranking: { id: string; name: string; points: number }[];
  answer: { choice: number; points: number | null } | null;
  received: number | null;
};
export const statusLabels: Record<GameStatus, string> = {
  lobby: "Sala de espera",
  question: "En juego",
  reveal: "En juego",
  finished: "Finalizada",
};

export const blank = (): Question => ({
  text: "",
  options: ["", "", "", ""],
  correct: 0,
  seconds: 35,
  points: 1000,
  double: false,
});
export function validate(q: Question): string[] {
  const e: string[] = [];
  if (!q.text.trim() || q.text.length > 2000)
    e.push("Pregunta: entre 1 y 2000 caracteres");
  if (
    q.options.length !== 4 ||
    q.options.some((o) => !o.trim() || o.length > 500)
  )
    e.push("Completá las cuatro opciones (máximo 500 caracteres)");
  if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3)
    e.push("Respuesta correcta: A, B, C o D");
  if (!Number.isInteger(q.seconds) || q.seconds < 5 || q.seconds > 300)
    e.push("Tiempo: entre 5 y 300 segundos");
  if (!Number.isInteger(q.points) || q.points < 100 || q.points > 10000)
    e.push("Puntaje: entre 100 y 10000");
  return e;
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function download(
  name: string,
  text: string,
  type = "text/csv;charset=utf-8",
) {
  const u = URL.createObjectURL(new Blob(["\ufeff" + text], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  const delimiter = text.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Comillas sin cerrar");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export const headers = [
  "pregunta",
  "opcion_a",
  "opcion_b",
  "opcion_c",
  "opcion_d",
  "correcta",
  "segundos",
  "puntos",
  "doble",
];
export function importRows(rows: string[][]) {
  if (
    !rows.length ||
    headers.some((h, i) => rows[0][i]?.trim().toLowerCase() !== h)
  )
    throw Error("Encabezados inválidos. Usá la plantilla.");
  if (rows.length === 1) throw Error("El archivo no contiene preguntas");
  if (rows.length > 101) throw Error("Máximo 100 preguntas");
  return rows.slice(1).map((r, index) => {
    const q: Question = {
      text: r[0] ?? "",
      options: r.slice(1, 5),
      correct: /^[A-D]$/i.test((r[5] ?? "").trim())
        ? "ABCD".indexOf(r[5].trim().toUpperCase())
        : -1,
      seconds: Number(r[6]),
      points: Number(r[7]),
      double: /^(si|sí|true|1)$/i.test((r[8] ?? "").trim()),
    };
    const errors = validate(q);
    if (!/^(si|sí|no|false|true|0|1)$/i.test((r[8] ?? "").trim()))
      errors.push("Doble: sí o no");
    return { q, errors, row: index + 2 };
  });
}
