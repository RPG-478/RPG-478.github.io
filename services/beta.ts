import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

export async function fetchBetaRemaining() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const { data, error } = await supabase.functions.invoke("beta-remaining", {
    method: "POST",
  });

  if (error) {
    const message = error.context?.bodyText || error.message;
    throw new Error(message || "取得に失敗しました。");
  }

  return data as { limit: number; used: number; remaining: number };
}
