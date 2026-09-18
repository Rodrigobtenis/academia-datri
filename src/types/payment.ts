export type PaymentType = "sena" | "parcial" | "final" | "completo" | "ajuste" | "reintegro";
export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "mercado_pago"
  | "tarjeta_debito"
  | "tarjeta_credito"
  | "otro";
export type PaymentStatus = "valido" | "anulado";

export interface Payment {
  id: string;
  enrollment_id: string;
  payment_date: string;
  amount: string;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  status: PaymentStatus;
  related_payment_id: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
  cash_discount_percent: string | null;
  cash_discount_amount: string | null;
}

export type PaymentInput = Pick<
  Payment,
  "enrollment_id" | "payment_date" | "amount" | "payment_type" | "payment_method" | "reference" | "notes"
>;

// Payload del formulario de pago: "amount" es siempre el monto NOMINAL (lo que se carga
// antes de cualquier descuento) — si cash_discount_percent tiene valor, el monto realmente
// cobrado y acreditado se calculan a partir de ahí (ver register_cash_discount_payment).
export type PaymentFormValues = PaymentInput & { cash_discount_percent: number | null };

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  sena: "Seña",
  parcial: "Pago parcial",
  final: "Pago final",
  completo: "Pago completo",
  ajuste: "Ajuste",
  reintegro: "Reintegro",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
  tarjeta_debito: "Tarjeta de débito",
  tarjeta_credito: "Tarjeta de crédito",
  otro: "Otro",
};
