-- Nuevo tipo de documento "contrato": se adjunta (PDF) por inscripción desde la solapa
-- de Asistencia y certificados de cada edición.
alter type document_type add value if not exists 'contrato';
