import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { type, rating, message, summary, steps, expected, actual, context } = body ?? {};

    if (!type || (type !== "feedback" && type !== "bug")) {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string | null = null;
    if (accessToken) {
      const { data: authData } = await admin.auth.getUser(accessToken);
      userId = authData?.user?.id ?? null;
    }

    if (type === "feedback") {
      const safeRating = Number(rating);
      if (!safeRating || safeRating < 1 || safeRating > 5) {
        return new Response(JSON.stringify({ error: "Rating must be 1-5" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.from("feedback").insert({
        user_id: userId,
        rating: safeRating,
        message: message ?? null,
        context: context ?? null,
        user_agent: req.headers.get("user-agent") ?? null,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (type === "bug") {
      if (!summary || typeof summary !== "string") {
        return new Response(JSON.stringify({ error: "Summary is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.from("bug_reports").insert({
        user_id: userId,
        summary,
        steps: steps ?? null,
        expected: expected ?? null,
        actual: actual ?? null,
        context: context ?? null,
        user_agent: req.headers.get("user-agent") ?? null,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
