export interface Professional {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  commission_percent: string;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export type ProfessionalInput = Omit<Professional, "id" | "created_at">;

export interface ProfessionalCommission {
  professional_id: string;
  year: number;
  month: number;
  appointment_count: number;
  total_billed: string;
  commission_amount: string;
}
