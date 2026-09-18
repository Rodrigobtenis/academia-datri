-- Empleada ahora puede crear ediciones de curso (antes exclusivo admin) —
-- editar y eliminar una edición existente sigue siendo admin-only.

drop policy if exists "course_editions_write_admin" on course_editions;

create policy "course_editions_insert" on course_editions
  for insert with check (is_active_profile());
