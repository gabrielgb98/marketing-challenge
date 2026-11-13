import { createClient, type User } from "@supabase/supabase-js";
import type { GameSummary, Quiz } from "./classrush";

export type Teacher = Pick<User, "id" | "email">;
export type QuizDraft = Omit<Quiz, "id">;
export type Session = { user: Teacher | null; confirmationRequired?: boolean };
export type GameAction = "create" | "state" | "join" | "submit" | "advance";
export const privatePilot = process.env.NEXT_PUBLIC_CLASSRUSH_PILOT === "1";

function result<T>(response: { data: T; error: { message: string } | null }): T {
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

function supabaseApi(url: string, key: string) {
  const client = createClient(url, key);
  return {
    async user(): Promise<Teacher | null> {
      const { data } = await client.auth.getUser();
      return data.user;
    },
    async login(email: string, password: string): Promise<Session> {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return { user: data.user };
    },
    async register(email: string, password: string, name: string): Promise<Session> {
      const data = result(await client.auth.signUp({
        email, password, options: { data: { name }, emailRedirectTo: location.origin + "/docente" },
      }));
      return { user: data.session?.user ?? null, confirmationRequired: !data.session };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message);
    },
    async recover(email: string) {
      result(await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/recuperar" }));
    },
    async updatePassword(password: string) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    async library() {
      const [quizzes, games, profile] = await Promise.all([
        client.from("cr_quizzes").select("id,title,subject,description,questions").eq("archived", false).order("created_at", { ascending: false }),
        client.from("cr_games").select("code,title,status,created_at").order("created_at", { ascending: false }),
        client.from("cr_profiles").select("name").maybeSingle(),
      ]);
      return {
        quizzes: result(quizzes) as Quiz[],
        games: result(games) as GameSummary[],
        name: result(profile)?.name as string | undefined,
      };
    },
    async saveQuiz(quiz: QuizDraft, id?: string) {
      result(await (id ? client.from("cr_quizzes").update(quiz).eq("id", id) : client.from("cr_quizzes").insert(quiz)));
    },
    async archiveQuiz(id: string) {
      result(await client.from("cr_quizzes").update({ archived: true }).eq("id", id));
    },
    async saveProfile(id: string, name: string) {
      result(await client.from("cr_profiles").upsert({ id, name }));
    },
    async game<T>(action: GameAction, args: Record<string, unknown>): Promise<T> {
      return result(await client.rpc(action === "create" ? "cr_create_game" : "cr_" + action, args));
    },
  };
}

async function pilotRequest<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("/api/pilot/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(payload?.error ?? "No se pudo conectar con la prueba privada.");
  return payload.data;
}

function pilotApi(): ReturnType<typeof supabaseApi> {
  return {
    user: () => pilotRequest("user"),
    login: (email, password) => pilotRequest("login", { email, password }),
    register: (email, password, name) => pilotRequest("register", { email, password, name }),
    signOut: () => pilotRequest("logout"),
    recover: async () => { throw new Error("La recuperación por correo no está disponible en la prueba privada."); },
    updatePassword: async () => { throw new Error("La recuperación por correo no está disponible en la prueba privada."); },
    library: () => pilotRequest("library"),
    saveQuiz: (quiz, id) => pilotRequest("save-quiz", { quiz, id }),
    archiveQuiz: (id) => pilotRequest("archive-quiz", { id }),
    saveProfile: (_id, name) => pilotRequest("profile", { name }),
    game: (action, args) => pilotRequest("game-" + action, args),
  };
}

let api: ReturnType<typeof supabaseApi> | null = null;

export function db() {
  if (api) return api;
  if (privatePilot) return (api = pilotApi());
  const url = process.env.NEXT_PUBLIC_CLASSRUSH_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_CLASSRUSH_SUPABASE_ANON_KEY;
  if (url && key) api = supabaseApi(url, key);
  return api;
}
