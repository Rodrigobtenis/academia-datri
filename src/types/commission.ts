import type { PaymentMethod, PaymentType } from "./payment";

export interface CommissionPaymentRow {
  payment_id: string;
  enrollment_id: string;
  payment_date: string;
  amount: string;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  status: string;
  rate_percent: string;
  commission_amount: string;
  student_name?: string;
  course_name?: string;
  edition_label?: string;
}

export interface CommissionRateEntry {
  id: string;
  rate_percent: string;
  effective_from: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
