import { supabase as adminDb } from "@/lib/supabase";

export async function getAppSetting(key: string): Promise<string | null> {
  const { data } = await adminDb
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const { error } = await adminDb
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
