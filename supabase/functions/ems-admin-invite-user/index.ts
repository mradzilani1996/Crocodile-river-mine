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
  if (!token || token === authorization) return respond({ error: "Sign in before inviting staff." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond({ error: "Supabase function secrets are not configured. Contact the system administrator." }, 500);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: "Your sign-in session is invalid or expired." }, 401);

  const { data: callerProfile, error: profileError } = await adminClient
    .from("ems_profiles")
    .select("role,is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError) return respond({ error: "Could not verify your EMS permissions." }, 500);
  if (!callerProfile?.is_active || callerProfile.role !== "admin") {
    return respond({ error: "Only the active System Administrator can invite staff." }, 403);
  }

  let payload: { full_name?: string; email?: string; password?: string; role?: string };
  try {
    payload = await req.json();
  } catch {
    return respond({ error: "Enter the staff member's name, email and EMS role." }, 400);
  }

  const fullName = String(payload.full_name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const role = String(payload.role || "").trim();
  const password = String(payload.password || "");
  const allowedRoles = ["issuer", "magazine_master", "authorising_officer", "management"];

  if (fullName.length < 2 || fullName.length > 120) return respond({ error: "Enter a valid full name." }, 400);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: "Enter a valid work email address." }, 400);
  if (password.length < 12 || password.length > 128) return respond({ error: "Set an initial password between 12 and 128 characters." }, 400);
  if (!allowedRoles.includes(role)) return respond({ error: "Choose an approved operational EMS role. Administrator access cannot be granted through invitations." }, 400);

  const redirectTo = Deno.env.get("EMS_APP_URL") || "https://crocodileems.vercel.app/";
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName }, redirectTo,
  });
  if (inviteError || !inviteData.user) return respond({ error: inviteError?.message || "Supabase did not return the invited account." }, 400);
  const { error: passwordError } = await adminClient.auth.admin.updateUserById(inviteData.user.id, { password });
  if (passwordError) { await adminClient.auth.admin.deleteUser(inviteData.user.id); return respond({ error: passwordError.message }, 400); }

  const { error: createProfileError } = await adminClient.from("ems_profiles").insert({
    user_id: inviteData.user.id,
    full_name: fullName,
    email,
    role,
    is_active: true,
    created_by: authData.user.id,
  });

  if (createProfileError) {
    await adminClient.auth.admin.deleteUser(inviteData.user.id);
    return respond({ error: "The invitation could not be linked to an EMS profile: " + createProfileError.message }, 500);
  }

  return respond({ ok: true, invited_email: email, assigned_role: role });
});
