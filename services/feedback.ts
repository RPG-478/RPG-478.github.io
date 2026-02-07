import { supabase, supabaseUrl, supabaseAnonKey } from "./supabase";

export type FeedbackPayload = {
  rating: number;
  message?: string;
  context?: Record<string, unknown>;
};

export type BugReportPayload = {
  summary: string;
  steps?: string;
  expected?: string;
  actual?: string;
  context?: Record<string, unknown>;
};

async function postFeedback(payload: Record<string, unknown>) {
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

  const res = await fetch(`${supabaseUrl}/functions/v1/submit-feedback`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "送信に失敗しました。");
  }
}

export async function submitFeedback(payload: FeedbackPayload) {
  return postFeedback({ type: "feedback", ...payload });
}

export async function submitBugReport(payload: BugReportPayload) {
  return postFeedback({ type: "bug", ...payload });
}
