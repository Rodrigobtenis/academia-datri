-- Empleada ahora puede eliminar modelos (antes solo admin; editar ya podía desde 0007).
-- Incluye borrar la foto del bucket "modelos".

drop policy if exists "models_delete_admin" on models;
create policy "models_delete" on models
  for delete using (is_active_profile());

drop policy if exists "modelos_fotos_delete" on storage.objects;
create policy "modelos_fotos_delete" on storage.objects
  for delete using (bucket_id = 'modelos' and is_active_profile());
