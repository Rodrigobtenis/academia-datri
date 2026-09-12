export type Role = "admin" | "empleada";

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
}
