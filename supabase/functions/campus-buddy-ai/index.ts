import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string;
  branch: string | null;
  year: string | null;
  section: string | null;
}

interface HistoryMessage {
  role: "user" | "buddy";
  text: string;
}

const SYSTEM_PROMPT = `You are Campus Buddy, a friendly and helpful AI assistant for CampusSync — a college campus information platform.

Your job is to answer students' questions about campus information using ONLY the real-time data provided to you in the context below. You are grounded in this data — do not make up information that isn't in the context.

## CampusSync Sections
The platform has these sections, each with a navigation path and highlight anchor:
- Notices: path="/notices", highlight="latest-notice" — Official college notices from administration
- Announcements: path="/announcements", highlight="latest-announcement" — Society and club announcements
- Events: path="/events", highlight="upcoming-events" — Upcoming college events
- Dashboard (Notifications): path="/dashboard", highlight="notifications" — Personal notifications/alerts
- Dashboard (CR Updates): path="/dashboard", highlight="cr-updates" — Class Representative updates
- Timetable: path="/timetable", highlight="timetable" — Weekly class schedule
- Timetable (Clashes): path="/timetable", highlight="clashes" — Schedule conflict detection

## Response Guidelines
1. Be concise, warm, and conversational — like a knowledgeable friend.
2. Use the provided campus data to give accurate, specific answers. Quote titles, dates, locations, etc.
3. If the data doesn't contain what the student asked about, say so honestly and suggest where to look.
4. When your answer relates to a specific section, include an "action" object so the student can navigate there.
5. For general/overview answers, include "quickLinks" with 2-4 relevant navigation buttons.
6. Do NOT mention that you are an AI or that you're using data from a database — just answer naturally.
7. Use plain text (no markdown). Use line breaks for readability.

## Response Format
You MUST respond as JSON with this structure:
{
  "text": "Your response text here",
  "action": { "path": "/path", "highlight": "anchor", "label": "Button Label" },
  "quickLinks": [{ "label": "Label", "path": "/path", "highlight": "anchor" }]
}
- "text" is always required.
- "action" is optional — include it when the answer points to a single section.
- "quickLinks" is optional — include it for general/overview answers.
- Never include both "action" and "quickLinks" at the same time.
- Only use paths and highlights from the sections listed above.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured. Add GEMINI_API_KEY as an edge function secret." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authorization = req.headers.get("Authorization") || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken);
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = callerData.user.id;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle() as { data: Profile | null };

    const body = await req.json();
    const query: string = body.query || "";
    const history: HistoryMessage[] = Array.isArray(body.history) ? body.history : [];

    if (!query.trim()) {
      return new Response(
        JSON.stringify({ text: "Hi! Ask me anything about CampusSync — notices, events, announcements, your timetable, and more!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

    const [noticesRes, announcementsRes, eventsRes, crUpdatesRes, classesRes, notificationsRes] = await Promise.all([
      supabaseAdmin.from("notices").select("title, description, date, department, deadline").order("date", { ascending: false }).limit(5),
      supabaseAdmin.from("announcements").select("title, content, society_name, date, event_date, event_time, registration_deadline, event_location").order("date", { ascending: false }).limit(5),
      supabaseAdmin.from("events").select("title, description, date, start_time, end_time, location, organizer").gte("date", today).order("date").limit(5),
      profile?.branch && profile?.year && profile?.section
        ? supabaseAdmin.from("cr_updates").select("*").eq("branch", profile.branch).eq("year", profile.year).eq("section", profile.section).order("date", { ascending: false }).limit(5)
        : supabaseAdmin.from("cr_updates").select("*").order("date", { ascending: false }).limit(5),
      supabaseAdmin.from("classes").select("subject, day_of_week, start_time, end_time, room").eq("user_id", userId).order("start_time"),
      supabaseAdmin.from("notifications").select("title, description, read, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
    ]);

    const contextParts: string[] = [];

    contextParts.push(`## Student Profile
- Name: ${profile?.full_name || "Unknown"}
- Department: ${profile?.department || "General"}
- Branch: ${profile?.branch || "Not set"}
- Year: ${profile?.year || "Not set"}
- Section: ${profile?.section || "Not set"}
- Today: ${todayName}, ${today}`);

    if (noticesRes.data && noticesRes.data.length > 0) {
      const noticeText = noticesRes.data.map((n: any) =>
        `- ${n.title} | Dept: ${n.department} | Date: ${n.date}${n.deadline ? ` | Deadline: ${n.deadline}` : ""} | ${n.description}`
      ).join("\n");
      contextParts.push(`## Latest Notices\n${noticeText}`);
    } else {
      contextParts.push("## Latest Notices\nNo notices found.");
    }

    if (announcementsRes.data && announcementsRes.data.length > 0) {
      const annText = announcementsRes.data.map((a: any) =>
        `- ${a.title} by ${a.society_name} | Date: ${a.date}${a.event_date ? ` | Event Date: ${a.event_date}` : ""}${a.event_time ? ` at ${a.event_time}` : ""}${a.event_location ? ` | Location: ${a.event_location}` : ""}${a.registration_deadline ? ` | Registration Deadline: ${a.registration_deadline}` : ""} | ${a.content}`
      ).join("\n");
      contextParts.push(`## Latest Society Announcements\n${annText}`);
    } else {
      contextParts.push("## Latest Society Announcements\nNo announcements found.");
    }

    if (eventsRes.data && eventsRes.data.length > 0) {
      const eventText = eventsRes.data.map((e: any) =>
        `- ${e.title} on ${e.date} from ${e.start_time} to ${e.end_time} at ${e.location} | Organizer: ${e.organizer} | ${e.description}`
      ).join("\n");
      contextParts.push(`## Upcoming Events\n${eventText}`);
    } else {
      contextParts.push("## Upcoming Events\nNo upcoming events found.");
    }

    if (crUpdatesRes.data && crUpdatesRes.data.length > 0) {
      const crText = crUpdatesRes.data.map((u: any) =>
        `- ${u.update_type} for ${u.subject} on ${u.date} from ${u.start_time}${u.end_time ? ` to ${u.end_time}` : ""}${u.location ? ` at ${u.location}` : ""} | ${u.description}`
      ).join("\n");
      contextParts.push(`## Class Representative Updates (for ${profile?.branch || "your"} ${profile?.year || ""} ${profile?.section ? `Section ${profile.section}` : ""})\n${crText}`);
    } else {
      contextParts.push("## Class Representative Updates\nNo CR updates found for your section.");
    }

    if (classesRes.data && classesRes.data.length > 0) {
      const todayClasses = classesRes.data.filter((c: any) => c.day_of_week === todayName);
      if (todayClasses.length > 0) {
        const classText = todayClasses.map((c: any) => `- ${c.subject} from ${c.start_time} to ${c.end_time} in Room ${c.room}`).join("\n");
        contextParts.push(`## Today's Classes (${todayName})\n${classText}`);
      } else {
        contextParts.push(`## Today's Classes (${todayName})\nNo classes scheduled for today.`);
      }
      const allClasses = classesRes.data.map((c: any) => `- ${c.day_of_week}: ${c.subject} from ${c.start_time} to ${c.end_time} in Room ${c.room}`).join("\n");
      contextParts.push(`## Full Weekly Timetable\n${allClasses}`);
    } else {
      contextParts.push("## Timetable\nNo classes found in the timetable.");
    }

    if (notificationsRes.data && notificationsRes.data.length > 0) {
      const unread = notificationsRes.data.filter((n: any) => !n.read).length;
      const notifText = notificationsRes.data.map((n: any) =>
        `- ${n.title} | ${n.read ? "Read" : "Unread"} | ${n.description}`
      ).join("\n");
      contextParts.push(`## Recent Notifications (${unread} unread)\n${notifText}`);
    } else {
      contextParts.push("## Recent Notifications\nNo notifications found.");
    }

    const contextBlock = contextParts.join("\n\n");

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of history.slice(-8)) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: `## Campus Data (Real-Time)\n${contextBlock}\n\n## Student Question\n${query}` }],
    });

    const geminiBody = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", errText);
      return new Response(
        JSON.stringify({ error: `Gemini API error (${geminiResponse.status}): ${errText.slice(0, 500)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return new Response(
        JSON.stringify({ error: "The AI assistant could not generate a response. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fencedJson = generatedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidateText = (fencedJson?.[1] || generatedText).trim();
    const objectStart = candidateText.indexOf("{");
    const objectEnd = candidateText.lastIndexOf("}");
    const cleanedText = objectStart >= 0 && objectEnd > objectStart
      ? candidateText.slice(objectStart, objectEnd + 1)
      : candidateText;

    let parsed: { text: string; action?: { path: string; highlight: string; label: string }; quickLinks?: Array<{ label: string; path: string; highlight: string }> };
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      parsed = { text: candidateText };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }    });
  }
});
