import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_CREDITS = 5;
const ACCOUNT_LIMIT = 500;

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

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized - no token provided" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = authHeader.slice(7);
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized - invalid token", details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);

    let { data: profile } = await admin
      .from("profiles")
      .select("id, plan, free_quota_remaining, daily_claimed_at")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true });

      const totalUsers = count ?? 0;
      if (totalUsers >= ACCOUNT_LIMIT) {
        return new Response(JSON.stringify({ error: "Account limit reached" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("profiles").insert({
        id: userId,
        plan: "free",
        free_quota_remaining: 0,
        daily_claimed_at: null,
      });
      profile = { plan: "free", free_quota_remaining: 0, daily_claimed_at: null } as any;
    }

    const claimedAt = profile?.daily_claimed_at ? String(profile.daily_claimed_at).slice(0, 10) : null;
    if (claimedAt === todayKey) {
      return new Response(JSON.stringify({ error: "Daily claim already used" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remaining = Math.max(0, (profile?.free_quota_remaining ?? 0) + DAILY_CREDITS);

    await admin
      .from("profiles")
      .update({ free_quota_remaining: remaining, daily_claimed_at: todayKey, daily_claimed_count: DAILY_CREDITS })
      .eq("id", userId);

    return new Response(JSON.stringify({ remaining, daily_claimed_at: todayKey }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
