-- Redefine qué puede ver el rol "Empleada":
--  - Gastos: antes exclusivo admin, ahora cualquier activo puede VER (crear/editar/
--    eliminar un gasto sigue siendo admin-only).
--  - Reportes: se queda con acceso admin-only, pero eso se resuelve a nivel de
--    ruta/UI (RequireAdmin) porque las tablas que usa (payments, enrollments, etc.)
--    ya son necesarias para el resto de la app y siguen con sus policies existentes.

drop policy if exists "expenses_all_admin" on expenses;

create policy "expenses_select" on expenses
  for select using (is_active_profile());

create policy "expenses_insert_admin" on expenses
  for insert with check (is_admin());

create policy "expenses_update_admin" on expenses
  for update using (is_admin());

create policy "expenses_delete_admin" on expenses
  for delete using (is_admin());
