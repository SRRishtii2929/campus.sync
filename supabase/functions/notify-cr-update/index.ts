import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { cr_update_id } = await req.json();
    if (!cr_update_id) {
      return new Response(JSON.stringify({ error: "cr_update_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: update, error: updateError } = await supabase
      .from("cr_updates")
      .select("id, cr_id, branch, year, section, subject, update_type, description, date, start_time, end_time")
      .eq("id", cr_update_id)
      .maybeSingle();

    if (updateError || !update) {
      return new Response(JSON.stringify({ error: "CR update not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: students, error: studentError } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .eq("branch", update.branch)
      .eq("year", update.year)
      .eq("section", update.section);

    if (studentError) {
      return new Response(JSON.stringify({ error: studentError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifTitle = `${update.update_type}: ${update.subject}`;
    const notifDesc = update.description;

    const notifications = students.map((s: { id: string }) => ({
      user_id: s.id,
      cr_update_id: update.id,
      title: notifTitle,
      description: notifDesc,
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ notified: students.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
