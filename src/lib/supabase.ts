import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local — la app no podrá conectarse a Supabase todavía."
  );
}

// Placeholder válido para que createClient no explote en desarrollo local sin backend todavía;
// cualquier llamada real simplemente fallará de red hasta que se complete .env.local.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key"
);
