-- Dos campos puntuales para que "online" deje de sentirse una copia pelada de presencial:
-- un link de acceso en la edición (grupo, drive, plataforma) y un check por alumna de si
-- ya se le mandó ese acceso. Ninguno de los dos aplica a presencial (queda null/false ahí).

alter table course_editions add column access_link text;
alter table enrollments add column access_sent boolean not null default false;
