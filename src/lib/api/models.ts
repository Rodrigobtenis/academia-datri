import { supabase } from "../supabase";
import { compressImage } from "../image-compress";
import type { ModelInput, ModelPerson, ModelWithServices } from "../../types/model";

const BUCKET = "modelos";

export async function listModels(): Promise<ModelWithServices[]> {
  const { data, error } = await supabase
    .from("models")
    .select("*, model_course_types(course_type_id, course_types(name))")
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = ModelPerson & {
    model_course_types: { course_type_id: string; course_types: { name: string } | null }[];
  };

  return (data as unknown as Row[]).map((r) => ({
    ...r,
    course_type_ids: r.model_course_types.map((m) => m.course_type_id),
    course_type_names: r.model_course_types.map((m) => m.course_types?.name ?? "—"),
  }));
}

async function setModelServices(modelId: string, courseTypeIds: string[]) {
  const { error: delError } = await supabase.from("model_course_types").delete().eq("model_id", modelId);
  if (delError) throw delError;
  if (courseTypeIds.length === 0) return;
  const { error: insError } = await supabase
    .from("model_course_types")
    .insert(courseTypeIds.map((course_type_id) => ({ model_id: modelId, course_type_id })));
  if (insError) throw insError;
}

async function uploadModelPhoto(modelId: string, file: File) {
  const compressed = await compressImage(file);
  const path = `${modelId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function createModel(input: ModelInput, courseTypeIds: string[], photo: File | null, createdBy: string | null) {
  const { data, error } = await supabase
    .from("models")
    .insert({ ...input, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;

  await setModelServices(data.id, courseTypeIds);

  if (photo) {
    const path = await uploadModelPhoto(data.id, photo);
    const { error: updError } = await supabase.from("models").update({ photo_url: path }).eq("id", data.id);
    if (updError) throw updError;
  }

  return data as ModelPerson;
}

export async function updateModel(
  id: string,
  input: ModelInput,
  courseTypeIds: string[],
  photo: File | null,
  updatedBy: string | null
) {
  const { error } = await supabase.from("models").update({ ...input, updated_by: updatedBy }).eq("id", id);
  if (error) throw error;

  await setModelServices(id, courseTypeIds);

  if (photo) {
    const path = await uploadModelPhoto(id, photo);
    const { error: updError } = await supabase.from("models").update({ photo_url: path }).eq("id", id);
    if (updError) throw updError;
  }
}

export async function deleteModel(model: ModelPerson) {
  if (model.photo_url) {
    await supabase.storage.from(BUCKET).remove([model.photo_url]);
  }
  const { error } = await supabase.from("models").delete().eq("id", model.id);
  if (error) throw error;
}

export async function getModelPhotoUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}
