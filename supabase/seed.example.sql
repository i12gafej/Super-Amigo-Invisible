-- Ejecutar manualmente en el editor SQL de Supabase. Sustituir ambas contraseñas.
-- Este archivo contiene exclusivamente valores ficticios, no credenciales reales.
insert into public.rooms(id,name,budget,event_date,password_hash,admin_password_hash)
values('navidad-2026','Navidad en familia',30,'2026-12-25',
 extensions.crypt('FICTICIA-CAMBIAR-SALA',extensions.gen_salt('bf',12)),
 extensions.crypt('FICTICIA-CAMBIAR-ADMIN-DISTINTA',extensions.gen_salt('bf',12)));
