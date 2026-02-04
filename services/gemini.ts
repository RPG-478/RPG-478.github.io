import { supabase } from "./supabase";

export interface GenerateResult {
  text: string;
  remaining?: number | null;
  plan?: string | null;
}

export async function* generateDiagramCodeStream(prompt: string, currentCode?: string): AsyncGenerator<GenerateResult> {
  const userMessage = currentCode 
    ? `現在の図のコード:\n${currentCode}\n\nユーザーの要望: ${prompt}`
    : prompt;

  try {
    const { data, error } = await supabase.functions.invoke('generate-diagram', {
      body: { prompt: userMessage }
    });

    if (error) {
      throw new Error(error.message || 'AI呼び出しに失敗しました。');
    }

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