import { createClient } from "@supabase/supabase-js";

// Server-side only — never use NEXT_PUBLIC_ prefix for these
const supabaseUrl = process.env.SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder";

export const supabase = createClient(supabaseUrl, supabaseKey);
