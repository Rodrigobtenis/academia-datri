-- Tercera modalidad de edición: "personalizado" (curso a medida para una alumna puntual:
-- se elige el curso, el monto y la fecha, y después funciona igual que cualquier edición).
-- Se agrega como valor del enum; no se usa en esta misma transacción.

alter type edition_modality add value if not exists 'personalizado';
