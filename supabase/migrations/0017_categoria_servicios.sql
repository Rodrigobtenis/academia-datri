-- Categoría del servicio (Rostro y Piel, Uñas, Micropigmentación, etc.) — viene del listado
-- de servicios del estudio y se preserva como dato, aunque hoy la UI no agrupe por ella.
alter table services add column category text;
