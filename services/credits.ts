import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

export async function claimDailyCredits() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": supabaseAnonKey,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${supabaseUrl}/functions/v1/claim-daily-credits`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "送信に失敗しました。");
  }

  return res.json() as Promise<{ remaining: number; daily_claimed_at: string }>;
}
