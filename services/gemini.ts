import { supabaseUrl, supabaseAnonKey } from "./supabase";

export interface GenerateResult {
  text: string;
  remaining?: number | null;
  plan?: string | null;
}

export async function* generateDiagramCodeStream(
  prompt: string,
  currentCode?: string,
  accessToken?: string,
  options?: { isAutoFix?: boolean }
): AsyncGenerator<GenerateResult> {
  const userMessage = currentCode 
    ? `現在の図のコード:\n${currentCode}\n\nユーザーの要望: ${prompt}`
    : prompt;

  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase設定が見つかりません。');
    }
    if (!accessToken) {
      throw new Error('認証情報が見つかりません。');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-diagram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        prompt: userMessage,
        token: accessToken,
        isAutoFix: options?.isAutoFix ?? false,
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Edge Function error:', response.status, errBody);
      throw new Error(`Edge Function error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const text = (data?.text || '')
      .replace(/```mermaid/g, '')
      .replace(/```/g, '')
      .trim();

    yield {
      text,
      remaining: data?.remaining ?? null,
      plan: data?.plan ?? null
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("図の作成中に通信エラーが発生しました。");
  }
}