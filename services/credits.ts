import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

export async function claimDailyCredits() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const { data, error } = await supabase.functions.invoke("claim-daily-credits", {
    method: "POST",
  });

  if (error) {
    const message = error.context?.bodyText || error.message;
    throw new Error(message || "送信に失敗しました。");
  }

  return data as { remaining: number; daily_claimed_at: string };
}
