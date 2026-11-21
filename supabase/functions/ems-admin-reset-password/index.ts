import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || token === authorization) return respond({ error: "Sign in before resetting a password." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return respond({ error: "Supabase function secrets are not configured." }, 500);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: "Your sign-in session is invalid or expired." }, 401);

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from("ems_profiles").select("full_name,role,is_active")
    .eq("user_id", authData.user.id).maybeSingle();
  if (callerProfileError) return respond({ error: "Could not verify your EMS permissions." }, 500);
  if (!callerProfile?.is_active || callerProfile.role !== "admin") return respond({ error: "Only the active System Administrator can reset staff passwords." }, 403);

  let payload: { user_id?: string; password?: string };
  try { payload = await req.json(); } catch { return respond({ error: "Select a staff member and enter a new password." }, 400); }

  const targetId = String(payload.user_id || "");
  const password = String(payload.password || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) return respond({ error: "Select a valid staff account." }, 400);
  if (targetId === authData.user.id) return respond({ error: "Use your own account password settings to change your administrator password." }, 400);
  if (password.length < 12 || password.length > 128) return respond({ error: "The new password must be between 12 and 128 characters." }, 400);

  const { data: targetProfile, error: targetError } = await adminClient
    .from("ems_profiles").select("full_name,email,role,is_active")
    .eq("user_id", targetId).maybeSingle();
  if (targetError) return respond({ error: "Could not verify the selected staff account." }, 500);
  if (!targetProfile || !targetProfile.is_active || targetProfile.role === "admin") return respond({ error: "Only active operational staff accounts can be reset here." }, 400);

  const { error: updateError } = await adminClient.auth.admin.updateUserById(targetId, { password });
  if (updateError) return respond({ error: updateError.message }, 400);

  const { error: auditError } = await adminClient.from("ems_audit_log").insert({
    actor_user_id: authData.user.id,
    actor_name: callerProfile.full_name || authData.user.email || "System Administrator",
    action: "PASSWORD_RESET",
    table_name: "auth.users",
    record_id: targetId,
    old_data: null,
    new_data: { target_name: targetProfile.full_name, target_email: targetProfile.email, method: "admin_in_app" },
  });
  if (auditError) return respond({ ok: true, audit_warning: "Password changed, but the audit entry could not be recorded. Contact the system administrator." });

  return respond({ ok: true, reset_for: targetProfile.email });
});
