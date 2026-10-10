-- Ejecutar SOLO en la base de pruebas desechable de CI.
-- Todas las filas y contraseñas son ficticias. Rollback al terminar.
\set ON_ERROR_STOP on
begin;
insert into public.rooms(id,name,budget,event_date,password_hash,admin_password_hash) values
('ci-a','Prueba A',30,'2026-12-25',extensions.crypt('test-room',extensions.gen_salt('bf',4)),extensions.crypt('test-admin',extensions.gen_salt('bf',4))),
('ci-b','Prueba B',30,'2026-12-25',extensions.crypt('test-room-b',extensions.gen_salt('bf',4)),extensions.crypt('test-admin-b',extensions.gen_salt('bf',4)));

do $$
declare
 a uuid; b uuid; c uuid; rev bigint; d1 uuid; d2 uuid; pairs jsonb; n integer;
begin
 if public.check_password('ci-a','test-room',false) is not true then raise exception 'Room password rejected'; end if;
 if public.check_password('ci-a','test-room',true) is true then raise exception 'Room password grants admin access'; end if;
 if public.check_password('missing','anything',false) is true then raise exception 'Unknown room accepted'; end if;
 a=public.register_participant('ci-a','Ana García','ana garcia',repeat('a',64),'test-cipher-a',false);
 b=public.register_participant('ci-a','Pablo Martín','pablo martin',repeat('b',64),'test-cipher-b',false);
 c=public.register_participant('ci-b','Otra Persona','otra persona',repeat('c',64),'test-cipher-c',false);
 if not exists(select 1 from public.find_matches('ci-a','ana garcia')) then raise exception 'Accent normalization match missing'; end if;
 begin
   perform public.register_participant('ci-a','Ana Garcia','ana garcia',repeat('d',64),'test-cipher-d',false);
   raise exception 'Duplicate admitted';
 exception when raise_exception then if sqlerrm<>'DUPLICATE' then raise; end if; end;
 perform public.edit_wishlist('ci-a',a,'Café',false,repeat('a',64));
 begin
   perform public.edit_wishlist('ci-b',a,'Cross-room edit',true,null);
   raise exception 'Cross-room edit admitted';
 exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise; end if; end;
 pairs=jsonb_build_array(jsonb_build_object('giver_id',a,'recipient_id',b),jsonb_build_object('giver_id',b,'recipient_id',a));
 select revision into rev from public.rooms where id='ci-a';
 -- La fórmula lógica debe ser verdadera para el conjunto completo.
 perform public.save_rules('ci-a',jsonb_build_object('op','AND','rules',jsonb_build_array(
   jsonb_build_object('op','pair','giver',a,'recipient',b),
   jsonb_build_object('op','NOT','rule',jsonb_build_object('op','pair','giver',a,'recipient',a))
 )),rev);
 begin
   perform public.commit_draw('ci-a',rev,pairs);
   raise exception 'Stale snapshot admitted';
 exception when raise_exception then if sqlerrm<>'STALE' then raise; end if; end;
 select revision into rev from public.rooms where id='ci-a';
 begin
   perform public.commit_draw('ci-a',rev,jsonb_build_array(jsonb_build_object('giver_id',a,'recipient_id',a),jsonb_build_object('giver_id',b,'recipient_id',b)));
   raise exception 'Self-assignment admitted';
 exception when raise_exception then if sqlerrm<>'INVALID_DRAW' then raise; end if; end;
 if exists(select 1 from public.draws where room_id='ci-a') then raise exception 'Invalid draw persisted'; end if;
 d1=public.commit_draw('ci-a',rev,pairs);
 if (select closed from public.rooms where id='ci-a') is not true then raise exception 'Draw did not close room'; end if;
 begin
   perform public.edit_wishlist('ci-a',a,'Closed edit',false,repeat('a',64));
   raise exception 'Closed edit admitted';
 exception when raise_exception then if sqlerrm<>'LOCKED' then raise; end if; end;
 perform public.set_edit_permission('ci-a',a,true);
 perform public.edit_wishlist('ci-a',a,'Updated recipient wishlist',false,repeat('a',64));
 if (select wishlist from public.participants where id=a)<>'Updated recipient wishlist' then raise exception 'Exceptional edit failed'; end if;
 perform public.set_edit_permission('ci-a',a,false);
 perform public.edit_wishlist('ci-a',a,'Admin edit',true,null);
 perform public.rotate_token('ci-a',a,null,null);
 if (select active from public.participants where id=a) is not false then raise exception 'Revocation failed'; end if;
 begin
   perform public.edit_wishlist('ci-a',a,'Revoked edit',false,repeat('a',64));
   raise exception 'Revoked token admitted';
 exception when raise_exception then if sqlerrm<>'REVOKED' then raise; end if; end;
 perform public.rotate_token('ci-a',a,repeat('e',64),'test-cipher-new');
 begin
   perform public.edit_wishlist('ci-a',a,'Old token edit',false,repeat('a',64));
   raise exception 'Old token admitted after regeneration';
 exception when raise_exception then if sqlerrm<>'REVOKED' then raise; end if; end;
 begin
   update public.draws set participant_count=99 where id=d1;
   raise exception 'Draw mutation admitted';
 exception when raise_exception then if sqlerrm not like 'Los sorteos son inmutables%' then raise; end if; end;
 begin
   delete from public.assignments where draw_id=d1;
   raise exception 'Assignment deletion admitted';
 exception when raise_exception then if sqlerrm not like 'Los sorteos son inmutables%' then raise; end if; end;
 select revision into rev from public.rooms where id='ci-a';
 d2=public.commit_draw('ci-a',rev,pairs);
 if d1=d2 or (select count(*) from public.draws where room_id='ci-a')<>2 then raise exception 'History overwritten'; end if;
 if (select current_draw_id from public.rooms where id='ci-a')<>d2 then raise exception 'Current draw not advanced'; end if;
 if public.consume_rate_limit('ci-rate-limit',1) is not true or public.consume_rate_limit('ci-rate-limit',1) is not false then raise exception 'Rate limit failed'; end if;
 select count(*) into n from public.assignments where draw_id=d1;
 if n<>2 then raise exception 'Old assignments not retained'; end if;
end $$;

do $$
declare role_name text; table_name text; f record;
begin
 foreach role_name in array array['anon','authenticated'] loop
   foreach table_name in array array['rooms','participants','draws','assignments','rate_limits'] loop
     if has_table_privilege(role_name,'public.'||table_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'Public table privilege: % %',role_name,table_name; end if;
   end loop;
   for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('consume_rate_limit','check_password','find_matches','register_participant','edit_wishlist','set_edit_permission','rotate_token','save_rules','evaluate_rule','commit_draw') loop
     if has_function_privilege(role_name,f.oid,'EXECUTE') then raise exception 'Public RPC privilege: %',role_name; end if;
   end loop;
 end loop;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('rooms','participants','draws','assignments','rate_limits') and not c.relrowsecurity) then raise exception 'Missing RLS'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.participants; raise exception 'Anonymous query admitted'; exception when insufficient_privilege then null; end;
 begin perform public.find_matches('ci-a','ana garcia'); raise exception 'Anonymous RPC admitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
 if public.check_password('ci-a','test-admin',true) is not true then raise exception 'Backend RPC access failed'; end if;
 begin update public.draws set participant_count=90 where room_id='ci-a'; raise exception 'Backend may mutate old draw'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
