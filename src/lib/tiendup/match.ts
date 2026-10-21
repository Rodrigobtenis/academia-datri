import type { CourseType } from "../../types/course";
import type { PaymentMethod } from "../../types/payment";

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "de", "la", "el", "los", "las", "del", "al", "y", "e", "en", "con", "tu", "tus", "para",
  "un", "una", "lo", "que", "mas", "por", "a", "o", "bonus",
]);

function tokens(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

export interface CourseMatch {
  courseType: CourseType;
  score: number;
}

// Compara el nombre del producto de Tiendup contra los nombres de las modalidades de curso
// que ya existen: puntaje = qué parte de las palabras del nombre de la modalidad aparecen en
// el producto (admite plurales/variantes por prefijo común de 5+ letras).
export function rankCourseMatches(productName: string, courseTypes: CourseType[]): CourseMatch[] {
  const productTokens = tokens(productName);
  const productNorm = normalizeText(productName);

  return courseTypes
    .map((ct) => {
      const typeTokens = tokens(ct.name);
      if (typeTokens.length === 0) return { courseType: ct, score: 0 };
      const hits = typeTokens.filter((tt) =>
        productTokens.some(
          (pt) => pt === tt || (Math.min(pt.length, tt.length) >= 5 && (pt.startsWith(tt) || tt.startsWith(pt)))
        )
      ).length;
      let score = hits / typeTokens.length;
      if (productNorm.includes(normalizeText(ct.name))) score = Math.max(score, 1);
      return { courseType: ct, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || b.courseType.name.length - a.courseType.name.length);
}

export function bestCourseMatch(productName: string, courseTypes: CourseType[]): CourseMatch | null {
  const ranked = rankCourseMatches(productName, courseTypes);
  if (ranked.length === 0 || ranked[0].score < 0.6) return null;
  // Si dos modalidades empatan el puntaje, no se adivina: que elija la persona.
  if (ranked[1] && ranked[1].score === ranked[0].score) return null;
  return ranked[0];
}

export function mapPaymentMethod(raw: string): PaymentMethod {
  const v = normalizeText(raw);
  if (v.includes("mercado")) return "mercado_pago";
  if (v.includes("transfer")) return "transferencia";
  if (v.includes("efectivo")) return "efectivo";
  if (v.includes("debito")) return "tarjeta_debito";
  if (v.includes("credito") || v.includes("tarjeta")) return "tarjeta_credito";
  return "otro";
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}
