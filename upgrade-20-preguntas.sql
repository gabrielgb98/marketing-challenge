-- Ejecutar en Supabase SQL Editor después de actualizar la app.
create or replace function public.advance_game(c text,t text,s text,i int) returns void language plpgsql security definer set search_path=public as $$
declare g games%rowtype;
begin select * into g from games where code=c for update;
if not found or g.token<>t then raise exception 'No autorizado';end if;
if not ((g.status='lobby' and s='question' and i=0) or (g.status='question' and s='reveal' and i=g.idx) or (g.status='reveal' and s='question' and i=g.idx+1 and i<20) or (g.status='reveal' and s='finished' and i=19 and g.idx=19)) then raise exception 'Transición inválida';end if;
update games set status=s,idx=i,started_at=case when s='question' then now() else started_at end where code=c;end $$;
create or replace function public.submit_answer(c text,t uuid,i int,a int) returns void language plpgsql security definer set search_path=public as $$
declare g games%rowtype; correct int; secs int; elapsed numeric; pts int;
begin select * into g from games where code=c for update;
if not found or g.status<>'question' or g.idx<>i then raise exception 'Pregunta cerrada';end if;
if not exists(select 1 from teams where id=t and code=c) then raise exception 'Equipo inválido';end if;
if a not between 0 and 3 then raise exception 'Opción inválida';end if;
correct:=case i when 0 then 0 when 1 then 1 when 2 then 3 when 3 then 2 when 4 then 0 when 5 then 0 when 6 then 1 when 7 then 1 when 8 then 1 when 9 then 0 when 10 then 1 when 11 then 0 when 12 then 1 when 13 then 0 when 14 then 2 when 15 then 1 when 16 then 1 when 17 then 2 when 18 then 2 when 19 then 1 else -1 end;
secs:=case i when 0 then 35 when 1 then 45 when 2 then 35 when 3 then 45 when 4 then 35 when 5 then 45 when 6 then 35 when 7 then 45 when 8 then 35 when 9 then 45 when 10 then 35 when 11 then 35 when 12 then 35 when 13 then 35 when 14 then 40 when 15 then 60 when 16 then 60 when 17 then 60 when 18 then 60 when 19 then 60 else 0 end;
if secs=0 then raise exception 'Pregunta inválida';end if;
elapsed:=extract(epoch from(now()-g.started_at));
if elapsed>secs then raise exception 'Tiempo agotado';end if;
pts:=case when a=correct then (1000+round(500*greatest(0,1-elapsed/secs))::int)*(case when i>=15 then 2 else 1 end) else 0 end;
insert into answers(code,team_id,idx,choice,points) values(c,t,i,a,pts);
update teams set points=points+pts where id=t;end $$;