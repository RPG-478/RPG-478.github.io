import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `
あなたはMermaid.jsコード生成に特化した高速AIアシスタントです。
解説や\`\`\`mermaid\`\`\`囲みは一切不要です。Mermaidコードのみを直接出力してください。

最優先事項：
1. 即座にMermaidコードのみを出力する。
2. 日本語ラベルを使用する。
3. 複雑すぎる装飾を避け、構造を明快にする。
4. ガントチャート、ER図、マインドマップ、フロー、シーケンスに対応する。

文法上の重要ルール（エラー防止）：
- Ganttチャートでは必ず \`dateFormat YYYY-MM-DD\` を指定し、日付は必ず \`2024-01-01\` の形式を使用してください。'q1_1' のような独自形式や不正な日付文字列は絶対に使用しないでください。
- タイムライン (timeline) でも有効な日付または文字列のみを使用してください。
- 接続は \`-->\` または \`--- \` を使用してください。

指示に忠実かつ迅速に応答してください。
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SB_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

    // Debug: log which env vars are present
    console.log("ENV check - SB_URL:", !!Deno.env.get("SB_URL"), "SUPABASE_URL:", !!Deno.env.get("SUPABASE_URL"));
    console.log("ENV check - serviceRoleKey present:", !!serviceRoleKey);

    if (!supabaseUrl || !serviceRoleKey || !geminiApiKey) {
      return new Response(JSON.stringify({ 
        error: "Missing environment variables",
        debug: {
          hasSbUrl: !!Deno.env.get("SB_URL"),
          hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
          hasServiceRole: !!serviceRoleKey,
          hasGemini: !!geminiApiKey
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const body = await req.json();
    const { prompt, token, isAutoFix } = body;
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract access token from Authorization header or body
    let accessToken = "";
    if (authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.slice(7);
    } else if (token) {
      accessToken = token;
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized - no token provided" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client with service role key to verify user tokens
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the access token using admin client
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData?.user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized - invalid token", details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    let { data: profile } = await admin
      .from("profiles")
      .select("plan, free_quota_remaining")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      profile = { plan: "free", free_quota_remaining: 20 } as any;
      await admin.from("profiles").insert({
        id: userId,
        plan: "free",
        free_quota_remaining: 20,
      });
    }

    const plan = profile?.plan ?? "free";
    let remaining = profile?.free_quota_remaining ?? 0;

    if (!isAutoFix && plan !== "pro" && remaining <= 0) {
      return new Response(JSON.stringify({ error: "Free quota exceeded", plan, remaining }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = plan === "pro" ? "gemini-3-pro-preview" : "gemini-3-flash-preview";

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") ?? "";

    if (!isAutoFix && plan !== "pro") {
      remaining = Math.max(0, (remaining ?? 0) - 1);
      await admin
        .from("profiles")
        .update({ free_quota_remaining: remaining })
        .eq("id", userId);
    }

    return new Response(JSON.stringify({ text, plan, remaining }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
