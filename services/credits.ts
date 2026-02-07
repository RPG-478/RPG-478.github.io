import { supabaseUrl, supabaseAnonKey } from "./supabase";

export async function claimDailyCredits(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase設定が見つかりません。");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/claim-daily-credits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errBody = await response.text();
    let msg = "送信に失敗しました。";
    try {
      const parsed = JSON.parse(errBody);
      msg = parsed.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await response.json();
  return data as { remaining: number; daily_claimed_at: string };
}
