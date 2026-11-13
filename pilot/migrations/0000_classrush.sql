CREATE TABLE teachers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  questions TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX quizzes_by_teacher ON quizzes(teacher_id, created_at);
CREATE TABLE games (
  code TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  title TEXT NOT NULL,
  questions TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby',
  idx INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX games_by_teacher ON games(teacher_id, created_at);
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL REFERENCES games(code),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  UNIQUE (code, name_key),
  UNIQUE (code, secret_hash)
);
CREATE TABLE answers (
  team_id TEXT NOT NULL REFERENCES teams(id),
  idx INTEGER NOT NULL,
  choice INTEGER NOT NULL,
  points INTEGER NOT NULL,
  PRIMARY KEY (team_id, idx)
);
