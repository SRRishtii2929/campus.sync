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

    const body = await req.json();
    const noticeId = body.notice_id;
    const announcementId = body.announcement_id;
    const eventId = body.event_id;

    if (!noticeId && !announcementId && !eventId) {
      return new Response(JSON.stringify({ error: "notice_id, announcement_id, or event_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (noticeId) {
      return await notifyNotice(supabase, noticeId, corsHeaders);
    } else if (announcementId) {
      return await notifyAnnouncement(supabase, announcementId, corsHeaders);
    } else {
      return await notifyEvent(supabase, eventId, corsHeaders);
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function notifyNotice(supabase: any, noticeId: string, corsHeaders: Record<string, string>) {
    const { data: notice, error: noticeError } = await supabase
      .from("notices")
      .select("id, title, description, target_branches, target_years")
      .eq("id", noticeId)
      .maybeSingle();

    if (noticeError || !notice) {
      return new Response(JSON.stringify({ error: "Notice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return await sendNotifications(supabase, corsHeaders, {
      itemId: notice.id,
      tableName: "notices",
      fkColumn: "notice_id",
      title: notice.title,
      description: notice.description,
      targetBranches: notice.target_branches,
      targetYears: notice.target_years,
    });
}

async function notifyAnnouncement(supabase: any, announcementId: string, corsHeaders: Record<string, string>) {
    const { data: ann, error: annError } = await supabase
      .from("announcements")
      .select("id, title, content, target_branches, target_years")
      .eq("id", announcementId)
      .maybeSingle();

    if (annError || !ann) {
      return new Response(JSON.stringify({ error: "Announcement not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return await sendNotifications(supabase, corsHeaders, {
      itemId: ann.id,
      tableName: "announcements",
      fkColumn: "announcement_id",
      title: ann.title,
      description: ann.content,
      targetBranches: ann.target_branches,
      targetYears: ann.target_years,
    });
}

async function notifyEvent(supabase: any, eventId: string, corsHeaders: Record<string, string>) {
    const { data: evt, error: evtError } = await supabase
      .from("events")
      .select("id, title, description, target_branches, target_years")
      .eq("id", eventId)
      .maybeSingle();

    if (evtError || !evt) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return await sendNotifications(supabase, corsHeaders, {
      itemId: evt.id,
      tableName: "events",
      fkColumn: "event_id",
      title: evt.title,
      description: evt.description,
      targetBranches: evt.target_branches,
      targetYears: evt.target_years,
    });
}

async function sendNotifications(
  supabase: any,
  corsHeaders: Record<string, string>,
  opts: {
    itemId: string;
    tableName: string;
    fkColumn: string;
    title: string;
    description: string;
    targetBranches: string[] | null;
    targetYears: string[] | null;
  },
) {
    const targetBranches = opts.targetBranches;
    const targetYears = opts.targetYears;
    const isGeneral = !targetBranches && !targetYears;

    let studentQuery = supabase
      .from("profiles")
      .select("id, branch, year")
      .eq("role", "student");

    if (!isGeneral) {
      const branches = targetBranches || [];
      const years = targetYears || [];

      if (branches.length > 0 && years.length > 0) {
        studentQuery = studentQuery.in("branch", branches).in("year", years);
      } else if (branches.length > 0) {
        studentQuery = studentQuery.in("branch", branches);
      } else if (years.length > 0) {
        studentQuery = studentQuery.in("year", years);
      }
    }

    const { data: students, error: studentError } = await studentQuery;

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

    const notifications = students.map((s: { id: string }) => ({
      user_id: s.id,
      notice_id: opts.tableName === "notices" ? opts.itemId : null,
      announcement_id: opts.tableName === "announcements" ? opts.itemId : null,
      event_id: opts.tableName === "events" ? opts.itemId : null,
      title: opts.title,
      description: opts.description,
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
}
