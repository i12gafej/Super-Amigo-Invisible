-- Importe mínimo para nuevas salas y para la sala existente de Navidad.
alter table public.rooms alter column budget set default 40;
update public.rooms set budget = 40 where id = 'navidad-2026';
