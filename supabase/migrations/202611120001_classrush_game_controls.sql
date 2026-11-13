-- Only ClassRush objects are touched. Existing games and team credentials stay valid.
begin;

create or replace function public.cr_join(c text,n text,secret text)
returns uuid language plpgsql security definer set search_path=public as $$
declare tid uuid; g cr_games%rowtype; hashed bytea;
begin
 if secret is null or length(secret) not between 32 and 200 then raise exception 'Credencial inválida'; end if;
 hashed:=sha256(convert_to(secret,'UTF8'));
 select * into g from cr_games where code=c for update;
 if not found then raise exception 'Partida no encontrada'; end if;
 select id into tid from cr_teams where code=c and secret_hash=hashed limit 1;
 if found then return tid; end if;
 if g.status<>'lobby' then raise exception 'Ingreso cerrado'; end if;
 if length(trim(n)) not between 2 and 30 then raise exception 'Ingresá un nombre de entre 2 y 30 caracteres'; end if;
 if (select count(*) from cr_teams where code=c)>=30 then raise exception 'Máximo 30 equipos'; end if;
 if exists(select 1 from cr_teams where code=c and lower(name)=lower(trim(n))) then raise exception 'Ese nombre ya está registrado. Elegí otro para tu equipo.'; end if;
 insert into cr_teams(code,name,secret_hash) values(c,trim(n),hashed) returning id into tid;
 return tid;
end $$;

create function public.cr_advance(c text, expected_status text, expected_idx int)
returns void language plpgsql security definer set search_path=public as $$
declare g cr_games%rowtype;
begin
 select * into g from cr_games where code=c and owner_id=auth.uid() for update;
 if not found then raise exception 'No autorizado'; end if;
 if g.status is distinct from expected_status or g.idx is distinct from expected_idx or g.status='finished' then return; end if;
 perform public.cr_advance(c);
end $$;

revoke all on function public.cr_advance(text,text,int) from public, anon;
grant execute on function public.cr_advance(text,text,int) to authenticated;
commit;
