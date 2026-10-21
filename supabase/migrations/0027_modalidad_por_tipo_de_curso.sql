-- Cada modalidad (tipo de curso) pertenece a UN tipo: presencial, online o personalizado.
-- Antes todas se veían en las tres pestañas porque solo las ediciones tenían tipo.
-- NULL = sin clasificar (se sigue viendo en todas hasta que se la asigne desde "Editar").

alter table course_types add column if not exists modality edition_modality;

-- Se clasifican solas las modalidades cuyas ediciones son todas del mismo tipo.
-- Las que tienen ediciones de varios tipos (o ninguna) quedan sin clasificar.
update course_types ct
set modality = sub.m
from (
  select course_type_id, min(modality::text)::edition_modality as m
  from course_editions
  group by course_type_id
  having count(distinct modality) = 1
) sub
where sub.course_type_id = ct.id and ct.modality is null;
