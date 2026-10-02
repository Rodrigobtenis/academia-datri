-- Empleada ahora puede crear, editar y eliminar gastos (antes solo verlos — 0009).
-- Mismo criterio que el resto de la operación diaria: cualquier perfil activo.

drop policy if exists "expenses_insert_admin" on expenses;
drop policy if exists "expenses_update_admin" on expenses;
drop policy if exists "expenses_delete_admin" on expenses;

create policy "expenses_insert" on expenses
  for insert with check (is_active_profile());

create policy "expenses_update" on expenses
  for update using (is_active_profile());

create policy "expenses_delete" on expenses
  for delete using (is_active_profile());
