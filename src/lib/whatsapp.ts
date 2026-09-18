// Arma un link wa.me con el mensaje ya escrito — al abrirlo, WhatsApp Web/app muestra el
// chat listo para enviar (todavía hace falta un click humano en "Enviar", no es 100%
// automático). Requiere anteponer el código de país (54 para Argentina) si no está ya.
export function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const withCountryCode = digits.startsWith("54") ? digits : `54${digits}`;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
}
