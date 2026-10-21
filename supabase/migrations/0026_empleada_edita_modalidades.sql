-- Empleada (ej. Mariana) puede editar el nombre y la descripción de una modalidad de curso.
-- Crear y eliminar modalidades sigue siendo solo admin.

drop policy if exists "course_types_update_admin" on course_types;
create policy "course_types_update" on course_types
  for update using (is_active_profile());
