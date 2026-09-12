-- Storage para documentos (comprobantes, DNI, formularios, consentimientos, certificados).
-- Bucket privado — el acceso real se sirve con URLs firmadas de corta duración, nunca público.

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Cualquier profile activo puede subir/ver/eliminar dentro del bucket "documentos".
-- La carpeta raíz de cada archivo es el id de la entidad (alumna o inscripción), pero
-- no se restringe por carpeta porque cualquier empleada/admin puede necesitar ver
-- cualquier documento de cualquier alumna (no hay noción de "dueño" del archivo acá).
create policy "documentos_select" on storage.objects
  for select using (bucket_id = 'documentos' and is_active_profile());

create policy "documentos_insert" on storage.objects
  for insert with check (bucket_id = 'documentos' and is_active_profile());

-- Borrar coherente con la tabla documents (documents_delete_admin): solo admin,
-- para no dejar un archivo huérfano en Storage cuando el DELETE del metadata falla.
create policy "documentos_delete" on storage.objects
  for delete using (bucket_id = 'documentos' and is_admin());
