-- Añadir a una instalación existente después de 001_secure_rooms.sql.
-- El historial de sorteos y las reglas existentes nunca se modifican al borrar.
create or replace function public.delete_participant(p_room text,p_person uuid) returns void
language plpgsql set search_path='' as $$
declare r public.rooms;
begin
 select * into r from public.rooms where id=p_room for update;
 if r.id is null then raise exception 'NOT_FOUND'; end if;
 perform 1 from public.participants where room_id=p_room and id=p_person for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from public.assignments where room_id=p_room and (giver_id=p_person or recipient_id=p_person)) then
  raise exception 'PARTICIPANT_HAS_HISTORY';
 end if;
 if jsonb_path_exists(r.rules,'$.** ? (@.op == "pair" && (@.giver == $person || @.recipient == $person))',jsonb_build_object('person',p_person::text)) then
  raise exception 'PARTICIPANT_HAS_RULES';
 end if;
 delete from public.participants where room_id=p_room and id=p_person;
 update public.rooms set revision=revision+1 where id=p_room;
end $$;
revoke execute on function public.delete_participant(text,uuid) from public,anon,authenticated;
grant delete on public.participants to service_role;
grant execute on function public.delete_participant(text,uuid) to service_role;
