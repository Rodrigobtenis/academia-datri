-- Ejecutar UNA VEZ, después de crear tu primer usuario en Supabase Auth
-- (Authentication > Users > Add user, con tu email de Admin).
-- El trigger on_auth_user_created ya le creó un profile con role='empleada';
-- acá lo promovemos a 'admin'.

update profiles
set role = 'admin'
where id = (select id from auth.users where email = 'TU_EMAIL_AQUI@ejemplo.com');
