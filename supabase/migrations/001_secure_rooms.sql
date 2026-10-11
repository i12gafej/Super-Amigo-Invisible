-- Supabase PostgreSQL. Todas las tablas privadas; solo el backend service_role.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;
create table public.rooms (
 id text primary key check (length(id) between 1 and 80),
 name text not null, budget numeric not null default 40 check (budget >= 0),
 event_date date not null, password_hash text not null, admin_password_hash text not null,
 closed boolean not null default false, revision bigint not null default 0,
 rules jsonb not null default '{"op":"AND","rules":[]}', current_draw_id uuid
);
create table public.participants (
 id uuid primary key default extensions.gen_random_uuid(), room_id text not null references public.rooms(id),
 name text not null check(length(name) between 2 and 80), normalized_name text not null,
 wishlist text not null default '' check(length(wishlist)<=4000),
 can_edit boolean not null default false, active boolean not null default true,
 token_hash text not null unique check(length(token_hash)=64), token_ciphertext text not null,
 created_at timestamptz not null default now(), unique(room_id,id)
);
create table public.draws (
 id uuid primary key default extensions.gen_random_uuid(), room_id text not null references public.rooms(id),
 created_at timestamptz not null default now(), participant_count integer not null,
 rules_snapshot jsonb not null, unique(room_id,id)
);
alter table public.rooms add constraint current_draw_in_room foreign key(id,current_draw_id) references public.draws(room_id,id);
create table public.assignments (
 room_id text not null, draw_id uuid not null, giver_id uuid not null, recipient_id uuid not null,
 primary key(draw_id,giver_id), unique(draw_id,recipient_id),check(giver_id<>recipient_id),
 foreign key(room_id,draw_id) references public.draws(room_id,id),
 foreign key(room_id,giver_id) references public.participants(room_id,id),
 foreign key(room_id,recipient_id) references public.participants(room_id,id)
);
create table public.rate_limits (key text primary key, window_start timestamptz not null, attempts integer not null);
create index participants_room_idx on public.participants(room_id);
create index draws_room_idx on public.draws(room_id,created_at desc);
alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.draws enable row level security;
alter table public.assignments enable row level security;
alter table public.rate_limits enable row level security;
-- No hay políticas para anon/authenticated. service_role solo vive en el servidor.
revoke all on public.rooms,public.participants,public.draws,public.assignments,public.rate_limits from public,anon,authenticated,service_role;
grant select,insert,update on public.rooms,public.participants to service_role;
grant select,insert on public.draws,public.assignments to service_role;
grant select,insert,update,delete on public.rate_limits to service_role;

create function public.consume_rate_limit(p_key text,p_limit integer) returns boolean language plpgsql set search_path='' as $$
declare n integer;
begin
 insert into public.rate_limits as r(key,window_start,attempts) values(p_key,now(),1)
 on conflict(key) do update set attempts=case when r.window_start<now()-interval '1 minute' then 1 else r.attempts+1 end,
 window_start=case when r.window_start<now()-interval '1 minute' then now() else r.window_start end returning attempts into n;
 delete from public.rate_limits where window_start<now()-interval '1 day';
 return n<=p_limit;
end $$;
create function public.check_password(p_room text,p_password text,p_admin boolean) returns boolean language plpgsql set search_path='' as $$
declare stored text; shared text;
begin
 select case when p_admin then admin_password_hash else password_hash end,password_hash into stored,shared from public.rooms where id=p_room;
 -- Incluso con una configuración errónea, la contraseña compartida nunca da acceso administrativo.
 if p_admin and shared is not null and extensions.crypt(p_password,shared)=shared then return false; end if;
 -- Hash ficticio cuando la sala no existe para no responder inmediatamente.
 return extensions.crypt(p_password,coalesce(stored,'$2a$12$abcdefghijklmnopqrstuuKXogPFdPQvdwkTkDvOS/J7VMJEV/CAS'))=stored;
end $$;
create function public.find_matches(p_room text,p_name text) returns table(name text) language sql stable set search_path='' as $$
 select p.name from public.participants p where p.room_id=p_room and
 (p.normalized_name=p_name or (least(length(p.normalized_name),length(p_name))>=3 and
 extensions.levenshtein(p.normalized_name,p_name)<=greatest(1,floor(greatest(length(p.normalized_name),length(p_name))*.2)))) limit 8;
$$;
create function public.register_participant(p_room text,p_name text,p_normalized text,p_hash text,p_cipher text,p_confirm boolean) returns uuid language plpgsql set search_path='' as $$
declare r public.rooms; person uuid;
begin
 select * into r from public.rooms where id=p_room for update;
 if r.id is null then raise exception 'NOT_FOUND'; end if;
 if r.closed then raise exception 'ROOM_CLOSED'; end if;
 if (select count(*) from public.participants where room_id=p_room)>=80 then raise exception 'LIMIT'; end if;
 if not p_confirm and exists(select 1 from public.find_matches(p_room,p_normalized)) then raise exception 'DUPLICATE'; end if;
 insert into public.participants(room_id,name,normalized_name,token_hash,token_ciphertext) values(p_room,p_name,p_normalized,p_hash,p_cipher) returning id into person;
 update public.rooms set revision=revision+1 where id=p_room;
 return person;
end $$;
create function public.edit_wishlist(p_room text,p_person uuid,p_wishlist text,p_admin boolean,p_hash text) returns void language plpgsql set search_path='' as $$
declare r public.rooms; p public.participants;
begin
 select * into r from public.rooms where id=p_room for update;
 select * into p from public.participants where id=p_person and room_id=p_room for update;
 if p.id is null then raise exception 'NOT_FOUND'; end if;
 if not p_admin and (not p.active or p.token_hash is distinct from p_hash) then raise exception 'REVOKED'; end if;
 if not p_admin and r.closed and not p.can_edit then raise exception 'LOCKED'; end if;
 update public.participants set wishlist=p_wishlist where id=p.id;
end $$;
create function public.set_edit_permission(p_room text,p_person uuid,p_enabled boolean) returns void language plpgsql set search_path='' as $$
begin
 perform 1 from public.rooms where id=p_room for update;
 update public.participants set can_edit=p_enabled where room_id=p_room and id=p_person;
 if not found then raise exception 'NOT_FOUND'; end if;
end $$;
create function public.rotate_token(p_room text,p_person uuid,p_hash text,p_cipher text) returns void language plpgsql set search_path='' as $$
begin
 perform 1 from public.rooms where id=p_room for update;
 update public.participants set active=p_hash is not null, token_hash=coalesce(p_hash,token_hash),token_ciphertext=coalesce(p_cipher,token_ciphertext) where room_id=p_room and id=p_person;
 if not found then raise exception 'NOT_FOUND'; end if;
end $$;
create function public.save_rules(p_room text,p_rules jsonb,p_revision bigint) returns void language plpgsql set search_path='' as $$
declare r public.rooms;
begin
 select * into r from public.rooms where id=p_room for update;
 if r.id is null then raise exception 'NOT_FOUND'; end if;
 if r.revision<>p_revision then raise exception 'STALE'; end if;
 update public.rooms set rules=p_rules,revision=revision+1 where id=p_room;
end $$;
create function public.evaluate_rule(p_rule jsonb,p_pairs jsonb,p_depth integer default 0) returns boolean language plpgsql immutable set search_path='' as $$
declare child jsonb; result boolean;
begin
 if p_depth>8 then raise exception 'INVALID_DRAW'; end if;
 case p_rule->>'op'
 when 'pair' then return exists(select 1 from jsonb_array_elements(p_pairs) x where x->>'giver_id'=p_rule->>'giver' and x->>'recipient_id'=p_rule->>'recipient');
 when 'NOT' then return not public.evaluate_rule(p_rule->'rule',p_pairs,p_depth+1);
 when 'AND' then
 if jsonb_typeof(p_rule->'rules') is distinct from 'array' then raise exception 'INVALID_DRAW'; end if;
 result=true;for child in select * from jsonb_array_elements(p_rule->'rules') loop result=result and public.evaluate_rule(child,p_pairs,p_depth+1);end loop;return result;
 when 'OR' then
 if jsonb_typeof(p_rule->'rules') is distinct from 'array' then raise exception 'INVALID_DRAW'; end if;
 result=false;for child in select * from jsonb_array_elements(p_rule->'rules') loop result=result or public.evaluate_rule(child,p_pairs,p_depth+1);end loop;return result;
 else raise exception 'INVALID_DRAW';
 end case;
end $$;
create function public.commit_draw(p_room text,p_revision bigint,p_assignments jsonb) returns uuid language plpgsql set search_path='' as $$
declare r public.rooms; n integer; draw uuid;
begin
 select * into r from public.rooms where id=p_room for update;
 if r.id is null then raise exception 'NOT_FOUND'; end if;
 if r.revision<>p_revision then raise exception 'STALE'; end if;
 select count(*) into n from public.participants where room_id=p_room;
 if n<2 or n>80 or jsonb_typeof(p_assignments) is distinct from 'array' or jsonb_array_length(p_assignments)<>n then raise exception 'INVALID_DRAW'; end if;
 if (select count(distinct x->>'giver_id') from jsonb_array_elements(p_assignments) x)<>n or
 (select count(distinct x->>'recipient_id') from jsonb_array_elements(p_assignments) x)<>n or
 exists(select 1 from jsonb_array_elements(p_assignments) x where x->>'giver_id'=x->>'recipient_id' or
 not exists(select 1 from public.participants p where p.room_id=p_room and p.id::text=x->>'giver_id') or
 not exists(select 1 from public.participants p where p.room_id=p_room and p.id::text=x->>'recipient_id')) or
 public.evaluate_rule(r.rules,p_assignments) is not true then raise exception 'INVALID_DRAW'; end if;
 insert into public.draws(room_id,participant_count,rules_snapshot) values(p_room,n,r.rules) returning id into draw;
 insert into public.assignments(room_id,draw_id,giver_id,recipient_id) select p_room,draw,(x->>'giver_id')::uuid,(x->>'recipient_id')::uuid from jsonb_array_elements(p_assignments) x;
 update public.rooms set current_draw_id=draw,closed=true,revision=revision+1 where id=p_room;
 return draw;
end $$;
create function public.reject_draw_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Los sorteos son inmutables. Ejecuta un nuevo sorteo.'; end $$;
create trigger immutable_draw before update or delete on public.draws for each row execute function public.reject_draw_mutation();
create trigger immutable_assignment before update or delete on public.assignments for each row execute function public.reject_draw_mutation();
-- Revocar explícitamente el EXECUTE que PostgreSQL concede por defecto a PUBLIC.
revoke execute on function public.consume_rate_limit(text,integer),public.check_password(text,text,boolean),public.find_matches(text,text),public.register_participant(text,text,text,text,text,boolean),public.edit_wishlist(text,uuid,text,boolean,text),public.set_edit_permission(text,uuid,boolean),public.rotate_token(text,uuid,text,text),public.save_rules(text,jsonb,bigint),public.evaluate_rule(jsonb,jsonb,integer),public.commit_draw(text,bigint,jsonb),public.reject_draw_mutation() from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer),public.check_password(text,text,boolean),public.find_matches(text,text),public.register_participant(text,text,text,text,text,boolean),public.edit_wishlist(text,uuid,text,boolean,text),public.set_edit_permission(text,uuid,boolean),public.rotate_token(text,uuid,text,text),public.save_rules(text,jsonb,bigint),public.evaluate_rule(jsonb,jsonb,integer),public.commit_draw(text,bigint,jsonb) to service_role;
