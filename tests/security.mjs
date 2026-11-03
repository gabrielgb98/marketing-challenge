import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
create table games(code text primary key, payload jsonb);insert into games values('224062','{"ranking":[100,200],"teams":["original"]}');create table teams(id int);create table answers(id int);`);
const before = await db.query("select * from games");
await db.exec(
  readFileSync("supabase/migrations/202611020001_classrush.sql", "utf8"),
);
const teacher = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
await db.query("insert into auth.users values($1),($2)", [teacher, other]);
async function as(role, id = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role " + role);
}
async function fails(sql, args = []) {
  await assert.rejects(() => db.query(sql, args));
}
await as("authenticated", teacher);
const q = [
  {
    text: "2+2",
    options: ["3", "4", "5", "6"],
    correct: 1,
    seconds: 35,
    points: 1000,
    double: true,
  },
];
const quiz = (
  await db.query(
    "insert into cr_quizzes(title,questions) values('Test',$1) returning id",
    [JSON.stringify(q)],
  )
).rows[0].id;
const code = (await db.query("select cr_create_game($1) c", [quiz])).rows[0].c;
await as("authenticated", other);
assert.equal((await db.query("select * from cr_quizzes")).rows.length, 0);
assert.equal((await db.query("select * from cr_games")).rows.length, 0);
await fails("select cr_create_game($1)", [quiz]);
await fails("select cr_advance($1)", [code]);
await as("anon");
await fails("select * from cr_games");
await fails("select * from cr_teams");
await fails("select * from cr_answers");
const secret = "a".repeat(64);
const tid = (
  await db.query("select cr_join($1,$2,$3) t", [code, "Equipo", secret])
).rows[0].t;
await fails("select cr_join($1,$2,$3)", [code, "Equipo", secret]);
await as("authenticated", teacher);
await db.query("select cr_advance($1)", [code]);
await as("anon");
async function state(s = secret) {
  return (await db.query("select cr_state($1,$2,$3) s", [code, tid, s])).rows[0]
    .s;
}
assert.equal((await state()).question.correct, undefined);
assert.equal((await state("wrong")).joinOnly, true);
await fails("select cr_submit($1,$2,$3,0,1)", [code, tid, "wrong"]);
await db.query("select cr_submit($1,$2,$3,0,1)", [code, tid, secret]);
await fails("select cr_submit($1,$2,$3,0,1)", [code, tid, secret]);
assert.equal((await state()).ranking[0].points, 0);
assert.equal((await state()).answer.points, null);
await as("authenticated", teacher);
await db.query("select cr_advance($1)", [code]);
await as("anon");
assert.equal((await state()).question.correct, 1);
assert.ok((await state()).ranking[0].points >= 2000);
await fails("select cr_submit($1,$2,$3,0,1)", [code, tid, secret]);
await as("authenticated", teacher);
await db.query("update cr_quizzes set questions=$1,archived=true where id=$2", [
  JSON.stringify([{ ...q[0], correct: 0 }]),
  quiz,
]);
await db.query("select cr_advance($1)", [code]);
assert.equal(
  (await db.query("select cr_state($1) s", [code])).rows[0].s.status,
  "finished",
);
await db.exec("reset role");
assert.deepEqual((await db.query("select * from games")).rows, before.rows);
assert.equal(
  (await db.query("select questions from cr_games where code=$1", [code]))
    .rows[0].questions[0].correct,
  1,
);
// A second, two-question game covers timeout and next-question transitions.
await as("authenticated", teacher);
const quiz2=(await db.query("insert into cr_quizzes(title,questions) values('Dos',$1) returning id",[JSON.stringify([q[0],{...q[0],double:false}])])).rows[0].id;
const code2=(await db.query('select cr_create_game($1) c',[quiz2])).rows[0].c;
await as('anon');
const team2=(await db.query('select cr_join($1,$2,$3) t',[code2,'Segundo',secret])).rows[0].t;
await as('authenticated',teacher);await db.query('select cr_advance($1)',[code2]);
await db.exec('reset role');await db.query("update cr_games set started_at=now()-interval '10 minutes' where code=$1",[code2]);
await as('anon');await fails('select cr_submit($1,$2,$3,0,1)',[code2,team2,secret]);
await fails('select cr_submit($1,$2,$3,0,1)',[code2,tid,secret]);
await as('authenticated',teacher);await db.query('select cr_advance($1)',[code2]);await db.query('select cr_advance($1)',[code2]);
assert.equal((await db.query('select cr_state($1) s',[code2])).rows[0].s.idx,1);
await as('anon');await fails('select cr_submit($1,$2,$3,0,1)',[code2,team2,secret]);
await fails('select cr_submit($1,$2,$3,1,null)',[code2,team2,secret]);
await db.query('select cr_submit($1,$2,$3,1,0)',[code2,team2,secret]);
await as('authenticated',teacher);await db.query('select cr_advance($1)',[code2]);await db.query('select cr_advance($1)',[code2]);
assert.equal((await db.query('select cr_state($1) s',[code2])).rows[0].s.ranking[0].points,0);
await db.exec('reset role');
// Malformed input and nulls cannot bypass validation.
assert.equal(
  (
    await db.query("select cr_valid_questions($1) v", [
      JSON.stringify([{ ...q[0], seconds: null }]),
    ])
  ).rows[0].v,
  false,
);
console.log(
  "PASS: tenant isolation, private answers, owner controls, team credentials, duplicate prevention, server scoring, snapshot, archival, legacy 224062 fixture unchanged",
);
await db.close();
