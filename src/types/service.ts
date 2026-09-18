export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: string;
  category: string | null;
  active: boolean;
  created_at: string;
}

export type ServiceInput = Omit<Service, "id" | "created_at">;
