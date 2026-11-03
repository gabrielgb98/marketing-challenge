-- ClassRush: additive and isolated. Apply ONLY to an independent test project first.
-- Never runs the legacy supabase.sql or changes games/teams/answers.
begin;
create table public.cr_profiles (
 id uuid primary key references auth.users(id), name text not null check(length(name) between 1 and 100)
);
create function public.cr_valid_questions(q jsonb) returns boolean language plpgsql immutable set search_path=public as $$
declare x jsonb; v jsonb;
begin
 if q is null or jsonb_typeof(q) <> 'array' or jsonb_array_length(q) not between 1 and 100 then return false; end if;
 for x in select value from jsonb_array_elements(q) loop
  if not (x ?& array['text','options','correct','seconds','points','double']) then return false; end if;
  if jsonb_typeof(x->'text') <> 'string' or length(trim(x->>'text')) not between 1 and 2000 or jsonb_typeof(x->'options') <> 'array' or jsonb_array_length(x->'options') <> 4 then return false; end if;
  for v in select value from jsonb_array_elements(x->'options') loop
   if jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 500 then return false; end if;
  end loop;
  if jsonb_typeof(x->'correct')<>'number' or jsonb_typeof(x->'seconds')<>'number' or jsonb_typeof(x->'points')<>'number' then return false; end if;
  if (x->>'correct') !~ '^[0-3]$' or (x->>'seconds') !~ '^[0-9]+$' or (x->>'points') !~ '^[0-9]+$' or jsonb_typeof(x->'double')<>'boolean' then return false; end if;
  if (x->>'seconds')::int not between 5 and 300 or (x->>'points')::int not between 100 and 10000 then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
create table public.cr_quizzes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 150), subject text not null default '' check(length(subject)<=150), description text not null default '' check(length(description)<=2000),
 questions jsonb not null check(public.cr_valid_questions(questions)), archived boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.cr_games (
 code text primary key check(code ~ '^[0-9]{6}$'), owner_id uuid not null references auth.users(id),
 quiz_id uuid references public.cr_quizzes(id), title text not null, questions jsonb not null,
 status text not null default 'lobby' check(status in ('lobby','question','reveal','finished')),
 idx int not null default 0, started_at timestamptz, created_at timestamptz not null default now()
);
create table public.cr_teams (
 id uuid primary key default gen_random_uuid(), code text not null references public.cr_games(code),
 name text not null check(length(trim(name)) between 2 and 30), secret_hash bytea not null, unique(code,name)
);
create table public.cr_answers (
 team_id uuid not null references public.cr_teams(id), idx int not null, choice int not null check(choice between 0 and 3),
 points int not null, answered_at timestamptz not null default now(), primary key(team_id,idx)
);
create index on public.cr_quizzes(owner_id); create index on public.cr_games(owner_id,created_at desc); create index on public.cr_teams(code);
alter table public.cr_profiles enable row level security;
alter table public.cr_quizzes enable row level security;
alter table public.cr_games enable row level security;
alter table public.cr_teams enable row level security;
alter table public.cr_answers enable row level security;
create policy profile_owner on public.cr_profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy quiz_owner on public.cr_quizzes for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy game_owner on public.cr_games for select to authenticated using(owner_id=auth.uid());
create policy team_owner on public.cr_teams for select to authenticated using(exists(select 1 from public.cr_games g where g.code=cr_teams.code and g.owner_id=auth.uid()));
create policy answer_owner on public.cr_answers for select to authenticated using(exists(select 1 from public.cr_teams t join public.cr_games g on g.code=t.code where t.id=cr_answers.team_id and g.owner_id=auth.uid()));
revoke all on public.cr_profiles,public.cr_quizzes,public.cr_games,public.cr_teams,public.cr_answers from anon,authenticated;
grant select,insert,update on public.cr_profiles,public.cr_quizzes to authenticated;
grant select on public.cr_games,public.cr_answers to authenticated;
grant select(id,code,name) on public.cr_teams to authenticated;
-- Quiz removal uses archival: games and question snapshots remain intact.
create function public.cr_create_game(quiz uuid) returns text language plpgsql security definer set search_path=public as $$
declare q cr_quizzes%rowtype; c text; tries int:=0;
begin
 select * into q from cr_quizzes where id=quiz and owner_id=auth.uid() and not archived;
 if not found then raise exception 'Cuestionario no disponible'; end if;
 loop
  c:=lpad(floor(random()*1000000)::int::text,6,'0'); tries:=tries+1;
  begin
   insert into cr_games(code,owner_id,quiz_id,title,questions) values(c,auth.uid(),q.id,q.title,q.questions); return c;
  exception when unique_violation then if tries>=20 then raise exception 'Intentá nuevamente'; end if; end;
 end loop;
end $$;
create function public.cr_advance(c text) returns void language plpgsql security definer set search_path=public as $$
declare g cr_games%rowtype;
begin
 select * into g from cr_games where code=c and owner_id=auth.uid() for update;
 if not found then raise exception 'No autorizado'; end if;
 if g.status='finished' then raise exception 'Partida finalizada'; end if;
 if g.status='lobby' and not exists(select 1 from cr_teams where code=c) then raise exception 'Esperá al menos un equipo'; end if;
 update cr_games set status=case when g.status in ('lobby','reveal') then case when g.status='reveal' and g.idx=jsonb_array_length(g.questions)-1 then 'finished' else 'question' end else 'reveal' end,
 idx=case when g.status='reveal' and g.idx<jsonb_array_length(g.questions)-1 then g.idx+1 else g.idx end,
 started_at=case when g.status in ('lobby','reveal') then clock_timestamp() else started_at end where code=c;
end $$;
create function public.cr_join(c text,n text,secret text) returns uuid language plpgsql security definer set search_path=public as $$
declare tid uuid; g cr_games%rowtype;
begin
 if secret is null or length(secret)<32 or length(secret)>200 then raise exception 'Credencial inválida'; end if;
 select * into g from cr_games where code=c for update;
 if not found or g.status<>'lobby' then raise exception 'Ingreso cerrado'; end if;
 if (select count(*) from cr_teams where code=c)>=30 then raise exception 'Máximo 30 equipos'; end if;
 insert into cr_teams(code,name,secret_hash) values(c,trim(n),sha256(convert_to(secret,'UTF8'))) returning id into tid; return tid;
end $$;
create function public.cr_submit(c text,tid uuid,secret text,i int,a int) returns void language plpgsql security definer set search_path=public as $$
declare g cr_games%rowtype; q jsonb; elapsed numeric; pts int;
begin
 select * into g from cr_games where code=c for update;
 if not found or g.status<>'question' or g.idx<>i then raise exception 'Pregunta cerrada'; end if;
 if not exists(select 1 from cr_teams where id=tid and code=c and secret_hash=sha256(convert_to(secret,'UTF8'))) then raise exception 'Equipo inválido'; end if;
 if a is null or a not between 0 and 3 then raise exception 'Opción inválida'; end if;
 q:=g.questions->i; elapsed:=extract(epoch from(clock_timestamp()-g.started_at));
 if elapsed<0 or elapsed>(q->>'seconds')::int then raise exception 'Tiempo agotado'; end if;
 pts:=case when a=(q->>'correct')::int then round((q->>'points')::int*(1+0.5*greatest(0,1-elapsed/(q->>'seconds')::int)))::int * case when (q->>'double')::boolean then 2 else 1 end else 0 end;
 insert into cr_answers(team_id,idx,choice,points) values(tid,i,a,pts);
end $$;
create function public.cr_state(c text,tid uuid default null,secret text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare g cr_games%rowtype; q jsonb; ranks jsonb; mine jsonb; owner boolean;
begin
 select * into g from cr_games where code=c;
 if not found then raise exception 'Partida no encontrada'; end if;
 owner:=coalesce(g.owner_id=auth.uid(),false);
 if not owner and not exists(select 1 from cr_teams where id=tid and code=c and secret_hash=sha256(convert_to(secret,'UTF8'))) then
  return jsonb_build_object('code',c,'status',g.status,'title',g.title,'joinOnly',true);
 end if;
 q:=g.questions->g.idx;
 if g.status not in ('reveal','finished') then q:=q-'correct'; end if;
 if g.status in ('lobby','finished') then q:=null; end if;
 select coalesce(jsonb_agg(r order by r.points desc,r.name),'[]') into ranks from (
  select t.id,t.name,coalesce(sum(a.points) filter(where g.status in ('reveal','finished') or a.idx<g.idx),0) points
  from cr_teams t left join cr_answers a on a.team_id=t.id where t.code=c group by t.id,t.name
 ) r;
 select jsonb_build_object('choice',a.choice,'points',case when g.status in ('reveal','finished') then a.points else null end) into mine from cr_answers a where a.team_id=tid and a.idx=g.idx;
 return jsonb_build_object('code',c,'title',g.title,'status',g.status,'idx',g.idx,'total',jsonb_array_length(g.questions),'started_at',g.started_at,'server_now',clock_timestamp(),'question',q,'ranking',ranks,'answer',mine,'received',case when owner then (select count(*) from cr_answers a join cr_teams t on t.id=a.team_id where t.code=c and a.idx=g.idx) else null end);
end $$;
revoke all on function public.cr_create_game(uuid),public.cr_advance(text),public.cr_join(text,text,text),public.cr_submit(text,uuid,text,int,int),public.cr_state(text,uuid,text) from public;
grant execute on function public.cr_create_game(uuid),public.cr_advance(text) to authenticated;
grant execute on function public.cr_join(text,text,text),public.cr_submit(text,uuid,text,int,int),public.cr_state(text,uuid,text) to anon,authenticated;
commit;
