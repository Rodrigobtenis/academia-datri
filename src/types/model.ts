export interface ModelPerson {
  id: string;
  first_name: string;
  last_name: string;
  age: number | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface ModelWithServices extends ModelPerson {
  course_type_ids: string[];
  course_type_names: string[];
}

export type ModelInput = {
  first_name: string;
  last_name: string;
  age: number | null;
  notes: string | null;
};
