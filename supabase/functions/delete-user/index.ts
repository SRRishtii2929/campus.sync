import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;

    const authorization = req.headers.get("Authorization") || "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller's session token
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken);
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check the caller is a college_admin or primary_admin (with approved status)
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, approval_status")
      .eq("id", callerData.user.id)
      .maybeSingle();

    if (!callerProfile || !["college_admin", "primary_admin"].includes(callerProfile.role) || callerProfile.approval_status !== "approved") {
      return new Response(JSON.stringify({ error: "Forbidden — only administrators can delete accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id || typeof target_user_id !== "string") {
      return new Response(JSON.stringify({ error: "target_user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (target_user_id === callerData.user.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the target user's profile to verify their role
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, email")
      .eq("id", target_user_id)
      .maybeSingle();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Never allow deleting primary_admin accounts
    if (targetProfile.role === "primary_admin") {
      return new Response(JSON.stringify({ error: "Cannot delete Primary Admin accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // College admins cannot delete other college admins; only primary_admins can
    if (targetProfile.role === "college_admin" && callerProfile.role !== "primary_admin") {
      return new Response(JSON.stringify({ error: "Only Primary Admins can delete College Admin accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete the auth user — this permanently removes login credentials.
    // The profiles row is removed automatically via ON DELETE CASCADE on the FK.
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);

    if (authDeleteError) {
      return new Response(JSON.stringify({ error: "Failed to delete auth account: " + authDeleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure the profile row is gone even if the cascade was not applied
    await supabaseAdmin.from("profiles").delete().eq("id", target_user_id);

    return new Response(JSON.stringify({ success: true, message: `Account ${targetProfile.email} permanently deleted` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
