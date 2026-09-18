-- Empleada ahora tiene paridad total con admin en ediciones de curso: editar y
-- eliminar (incluyendo la cascada completa "eliminar todo de todos modos"),
-- no solo crear (eso ya se habilitó en 0010).

drop policy if exists "course_editions_update_admin" on course_editions;
create policy "course_editions_update" on course_editions
  for update using (is_active_profile());

drop policy if exists "course_editions_delete_admin" on course_editions;
create policy "course_editions_delete" on course_editions
  for delete using (is_active_profile());

drop policy if exists "enrollments_delete_admin" on enrollments;
create policy "enrollments_delete" on enrollments
  for delete using (is_active_profile());

drop policy if exists "documents_delete_admin" on documents;
create policy "documents_delete" on documents
  for delete using (is_active_profile());

drop policy if exists "documentos_delete" on storage.objects;
create policy "documentos_delete" on storage.objects
  for delete using (bucket_id = 'documentos' and is_active_profile());

-- La única excepción real que sigue protegida: borrar pagos (y gastos) sigue sin tener
-- una policy de delete abierta a cualquiera (ni admin ni empleada pueden hacer
-- `delete from payments` libremente). La cascada de "eliminar edición" pasa ahora por
-- esta función SECURITY DEFINER, que solo borra pagos/gastos que pertenezcan a la
-- edición puntual que se está purgando — no habilita un botón de "borrar pago" suelto
-- en ningún otro lado de la app, igual que se documentó en 0006.
create or replace function purge_edition_financials(p_edition_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_active_profile() then
    raise exception 'No autorizado';
  end if;

  delete from payments
  where enrollment_id in (
    select id from enrollments where course_edition_id = p_edition_id
  );

  delete from expenses where course_edition_id = p_edition_id;
end;
$$;

grant execute on function purge_edition_financials(uuid) to authenticated;
