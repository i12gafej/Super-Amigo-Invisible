-- Solo en una base desechable de CI. Todo se revierte.
begin;
insert into public.rooms(id,name,budget,event_date,password_hash,admin_password_hash)
values('ci-remove-a','Sala de prueba A',30,'2026-12-25','fake-room','fake-admin'),('ci-remove-b','Sala de prueba B',30,'2026-12-25','fake-room','fake-admin');
do $$
declare a uuid; b uuid; c uuid; rev bigint; original_rule jsonb; pairs jsonb; draw uuid;
begin
 a=public.register_participant('ci-remove-a','Ana Prueba','ana prueba',repeat('1',64),'fake-cipher',false);
 b=public.register_participant('ci-remove-a','Luis Prueba','luis prueba',repeat('2',64),'fake-cipher',false);
 c=public.register_participant('ci-remove-b','Otra Persona','otra persona',repeat('3',64),'fake-cipher',false);
 select revision into rev from public.rooms where id='ci-remove-a';
 begin perform public.delete_participant('ci-remove-a',c);raise exception 'Cross-room deletion admitted';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 if not exists(select 1 from public.participants where id=c) then raise exception 'Other room participant deleted';end if;
 original_rule=jsonb_build_object('op','AND','rules',jsonb_build_array(jsonb_build_object('op','NOT','rule',jsonb_build_object('op','OR','rules',jsonb_build_array(jsonb_build_object('op','pair','giver',a,'recipient',b))))));
 update public.rooms set rules=original_rule where id='ci-remove-a';
 begin perform public.delete_participant('ci-remove-a',b);raise exception 'Rule recipient deletion admitted';exception when raise_exception then if sqlerrm<>'PARTICIPANT_HAS_RULES' then raise;end if;end;
 begin perform public.delete_participant('ci-remove-a',a);raise exception 'Rule giver deletion admitted';exception when raise_exception then if sqlerrm<>'PARTICIPANT_HAS_RULES' then raise;end if;end;
 if (select rules from public.rooms where id='ci-remove-a')<>original_rule or (select revision from public.rooms where id='ci-remove-a')<>rev then raise exception 'Blocked deletion changed room';end if;
 update public.rooms set rules='{"op":"AND","rules":[]}'::jsonb where id='ci-remove-a';
 perform public.delete_participant('ci-remove-a',b);
 if exists(select 1 from public.participants where id=b or token_hash=repeat('2',64)) then raise exception 'Participant or access token survived deletion';end if;
 if (select revision from public.rooms where id='ci-remove-a')<>rev+1 then raise exception 'Deletion did not invalidate draw snapshots';end if;
 if exists(select 1 from public.find_matches('ci-remove-a','luis prueba')) then raise exception 'Deleted name still matches';end if;
 begin perform public.delete_participant('ci-remove-a',b);raise exception 'Repeated deletion admitted';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 b=public.register_participant('ci-remove-a','Luis Prueba','luis prueba',repeat('4',64),'fake-new-cipher',false);
 pairs=jsonb_build_array(jsonb_build_object('giver_id',a,'recipient_id',b),jsonb_build_object('giver_id',b,'recipient_id',a));
 begin perform public.commit_draw('ci-remove-a',rev,pairs);raise exception 'Stale draw accepted after deletion';exception when raise_exception then if sqlerrm<>'STALE' then raise;end if;end;
 select revision into rev from public.rooms where id='ci-remove-a';
 draw=public.commit_draw('ci-remove-a',rev,pairs);
 begin perform public.delete_participant('ci-remove-a',a);raise exception 'Historical participant deletion admitted';exception when raise_exception then if sqlerrm<>'PARTICIPANT_HAS_HISTORY' then raise;end if;end;
 if (select count(*) from public.assignments where draw_id=draw)<>2 or (select current_draw_id from public.rooms where id='ci-remove-a')<>draw then raise exception 'Deletion damaged history';end if;
 if not exists(select 1 from public.participants where id=a) then raise exception 'Historical participant lost';end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.delete_participant('ci-remove-b',(select null::uuid));raise exception 'Anonymous RPC allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform public.delete_participant('ci-remove-b',(select null::uuid));raise exception 'Authenticated RPC allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$ declare c uuid;begin
 select id into c from public.participants where room_id='ci-remove-b';
 perform public.delete_participant('ci-remove-b',c);
 if exists(select 1 from public.participants where id=c) then raise exception 'Server RPC deletion failed';end if;
end $$;
reset role;
rollback;
