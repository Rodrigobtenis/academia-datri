-- Cada EDICIÓN (no la modalidad/course_type) se marca como presencial u online. Una misma
-- modalidad (ej. Hairstrokes) puede tener ediciones de ambos tipos. Las online no tienen
-- agenda real: se registran con la fecha del día en que se cargan, así cuentan para el mes
-- corriente en reportes/gestión igual que cualquier otra edición, pero no aparecen en la
-- Agenda ni en las alertas de "cursos próximos" (no tiene sentido para algo sin fecha real).

create type edition_modality as enum ('presencial', 'online');

alter table course_editions add column modality edition_modality not null default 'presencial';
