import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

export async function* generateDiagramCodeStream(prompt: string, currentCode?: string): AsyncGenerator<string> {
  // Use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const userMessage = currentCode 
    ? `現在の図のコード:\n${currentCode}\n\nユーザーの要望: ${prompt}`
    : prompt;

  try {
    // Upgrade to gemini-3-pro-preview for coding and complex tasks
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: userMessage,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    let fullText = "";
    // Iterating directly over the response object as it is the async iterable
    for await (const chunk of response) {
      const chunkText = chunk.text || "";
      fullText += chunkText;
      
      // Clean markdown on the fly if it starts appearing
      let cleaned = fullText
        .replace(/```mermaid/g, '')
        .replace(/```/g, '')
        .trim();
        
      yield cleaned;
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("図の作成中に通信エラーが発生しました。");
  }
}