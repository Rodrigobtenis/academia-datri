export interface WaitlistEntry {
  id: string;
  student_id: string;
  course_edition_id: string;
  priority: number;
  phone: string | null;
  notes: string | null;
  created_at: string;
  students: { id: string; first_name: string; last_name: string } | null;
}

export type WaitlistInput = {
  student_id: string;
  course_edition_id: string;
  priority: number;
  phone: string | null;
  notes: string | null;
};
