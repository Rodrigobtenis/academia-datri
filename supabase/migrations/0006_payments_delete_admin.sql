-- Excepción puntual y deliberada a "nunca se borran pagos": el admin pidió poder
-- eliminar por completo una edición de curso que se cayó (todas las alumnas cancelaron),
-- incluyendo sus pagos, cuando quiere que ese dinero deje de contar para siempre en
-- comisiones/objetivos/gestión. Solo admin, y solo se usa desde el flujo de doble
-- confirmación "Eliminar todo de todos modos" en la edición — no se expone ningún botón
-- de "borrar pago" suelto en ningún otro lado de la app.
create policy "payments_delete_admin" on payments
  for delete using (is_admin());
