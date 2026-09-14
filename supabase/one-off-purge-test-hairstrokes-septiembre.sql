-- Uso puntual: purga de datos de PRUEBA. Confirmado por el usuario como datos de
-- prueba, no reales. No usar este patrón para pagos/inscripciones reales - la app
-- deliberadamente no permite borrar pagos.

-- 1) Hairstrokes - "Edicion Septiembre" (con el pago de prueba de Micaela)
delete from payments where enrollment_id in (
  select id from enrollments where course_edition_id = 'fe150f2b-72ba-4d87-9770-3be2e91c18ea'
);
delete from enrollments where course_edition_id = 'fe150f2b-72ba-4d87-9770-3be2e91c18ea';
delete from course_editions where id = 'fe150f2b-72ba-4d87-9770-3be2e91c18ea';

-- 2) Trico - edición de prueba del 15/10/2026 (Julieta, Micaela, Carla + sus pagos)
delete from payments where enrollment_id in (
  select id from enrollments where course_edition_id = '590c5d55-0aa2-4f3c-b953-9bde84732987'
);
delete from enrollments where course_edition_id = '590c5d55-0aa2-4f3c-b953-9bde84732987';
delete from course_editions where id = '590c5d55-0aa2-4f3c-b953-9bde84732987';
