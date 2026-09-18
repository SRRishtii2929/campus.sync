import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string;
  branch: string | null;
  year: string | null;
  section: string | null;
  society_name: string | null;
  interests: string[] | null;
}

interface HistoryMessage {
  role: "user" | "buddy";
  text: string;
}

interface ServerClassEntry {
  id: string;
  subject: string;
  day_of_week: string;
  date: string | null;
  start_time: string;
  end_time: string;
  room: string;
}

interface ServerEventEntry {
  id: string;
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  organizer: string;
}

interface ServerAnnouncement {
  id: string;
  title: string;
  content: string;
  society_name: string;
  date: string;
  event_date: string | null;
  event_time: string | null;
  registration_deadline: string | null;
  event_location: string | null;
}

interface ClashDetail {
  type: string;
  activityA: { label: string; date: string; start: string; end: string };
  activityB: { label: string; date: string; start: string; end: string };
  overlapStart: string;
  overlapEnd: string;
  date: string;
  message: string;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTimeFromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function sameDate(dateA: string | null, dateB: string | null): boolean {
  if (!dateA || !dateB) return false;
  return dateA === dateB;
}

function addOneHour(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const newH = (h + 1) % 24;
  return `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function sameDayOfWeek(dayOfWeek: string, dateStr: string): boolean {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const date = new Date(dateStr + "T00:00:00");
  return days[date.getDay()] === dayOfWeek;
}

function detectClashes(
  classes: ServerClassEntry[],
  events: ServerEventEntry[],
  announcements: ServerAnnouncement[]
): ClashDetail[] {
  const clashes: ClashDetail[] = [];

  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const a = classes[i];
      const b = classes[j];
      const sameDateCheck = sameDate(a.date, b.date);
      const sameDayRecurring = !a.date && !b.date && a.day_of_week === b.day_of_week;
      if (sameDateCheck || sameDayRecurring) {
        if (rangesOverlap(toMinutes(a.start_time), toMinutes(a.end_time), toMinutes(b.start_time), toMinutes(b.end_time))) {
          const overlapStart = Math.max(toMinutes(a.start_time), toMinutes(b.start_time));
          const overlapEnd = Math.min(toMinutes(a.end_time), toMinutes(b.end_time));
          const dateStr = a.date || b.date || "";
          clashes.push({
            type: "class_class",
            activityA: { label: a.subject, date: dateStr, start: a.start_time, end: a.end_time },
            activityB: { label: b.subject, date: dateStr, start: b.start_time, end: b.end_time },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: dateStr,
            message: `Schedule Clash Detected: ${a.subject} Class overlaps with ${b.subject} Class from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  for (const cls of classes) {
    for (const evt of events) {
      if (cls.date && sameDate(cls.date, evt.date)) {
        if (rangesOverlap(toMinutes(cls.start_time), toMinutes(cls.end_time), toMinutes(evt.start_time), toMinutes(evt.end_time))) {
          const overlapStart = Math.max(toMinutes(cls.start_time), toMinutes(evt.start_time));
          const overlapEnd = Math.min(toMinutes(cls.end_time), toMinutes(evt.end_time));
          clashes.push({
            type: "class_event",
            activityA: { label: cls.subject, date: evt.date, start: cls.start_time, end: cls.end_time },
            activityB: { label: evt.title, date: evt.date, start: evt.start_time, end: evt.end_time },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: evt.date,
            message: `Schedule Clash Detected: ${cls.subject} Class overlaps with the ${evt.title} from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  for (const cls of classes) {
    for (const ann of announcements) {
      if (!ann.event_time) continue;
      const annDate = ann.event_date || ann.date;
      const annEnd = addOneHour(ann.event_time);
      const datesMatch = cls.date ? sameDate(cls.date, annDate) : sameDayOfWeek(cls.day_of_week, annDate);
      if (datesMatch) {
        if (rangesOverlap(toMinutes(cls.start_time), toMinutes(cls.end_time), toMinutes(ann.event_time), toMinutes(annEnd))) {
          const overlapStart = Math.max(toMinutes(cls.start_time), toMinutes(ann.event_time));
          const overlapEnd = Math.min(toMinutes(cls.end_time), toMinutes(annEnd));
          clashes.push({
            type: "class_announcement",
            activityA: { label: cls.subject, date: annDate, start: cls.start_time, end: cls.end_time },
            activityB: { label: ann.title, date: annDate, start: ann.event_time, end: annEnd },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: annDate,
            message: `Schedule Clash Detected: ${cls.subject} Class overlaps with the ${ann.title} announcement event from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  for (let i = 0; i < announcements.length; i++) {
    for (let j = i + 1; j < announcements.length; j++) {
      const a = announcements[i];
      const b = announcements[j];
      if (!a.event_time || !b.event_time) continue;
      const aDate = a.event_date || a.date;
      const bDate = b.event_date || b.date;
      if (sameDate(aDate, bDate)) {
        const aEnd = addOneHour(a.event_time);
        const bEnd = addOneHour(b.event_time);
        if (rangesOverlap(toMinutes(a.event_time), toMinutes(aEnd), toMinutes(b.event_time), toMinutes(bEnd))) {
          const overlapStart = Math.max(toMinutes(a.event_time), toMinutes(b.event_time));
          const overlapEnd = Math.min(toMinutes(aEnd), toMinutes(bEnd));
          clashes.push({
            type: "announcement_announcement",
            activityA: { label: a.title, date: aDate, start: a.event_time, end: aEnd },
            activityB: { label: b.title, date: bDate, start: b.event_time, end: bEnd },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: aDate,
            message: `Schedule Clash Detected: ${a.title} overlaps with ${b.title} from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  for (const evt of events) {
    for (const ann of announcements) {
      if (!ann.event_time) continue;
      const annDate = ann.event_date || ann.date;
      if (sameDate(evt.date, annDate)) {
        const annEnd = addOneHour(ann.event_time);
        if (rangesOverlap(toMinutes(evt.start_time), toMinutes(evt.end_time), toMinutes(ann.event_time), toMinutes(annEnd))) {
          const overlapStart = Math.max(toMinutes(evt.start_time), toMinutes(ann.event_time));
          const overlapEnd = Math.min(toMinutes(evt.end_time), toMinutes(annEnd));
          clashes.push({
            type: "event_announcement",
            activityA: { label: evt.title, date: evt.date, start: evt.start_time, end: evt.end_time },
            activityB: { label: ann.title, date: annDate, start: ann.event_time, end: annEnd },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: evt.date,
            message: `Schedule Clash Detected: ${evt.title} overlaps with the ${ann.title} announcement event from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (sameDate(a.date, b.date)) {
        if (rangesOverlap(toMinutes(a.start_time), toMinutes(a.end_time), toMinutes(b.start_time), toMinutes(b.end_time))) {
          const overlapStart = Math.max(toMinutes(a.start_time), toMinutes(b.start_time));
          const overlapEnd = Math.min(toMinutes(a.end_time), toMinutes(b.end_time));
          clashes.push({
            type: "event_event",
            activityA: { label: a.title, date: a.date, start: a.start_time, end: a.end_time },
            activityB: { label: b.title, date: b.date, start: b.start_time, end: b.end_time },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: a.date,
            message: `Schedule Clash Detected: ${a.title} overlaps with ${b.title} from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  return clashes.filter((c) => {
    const clashDate = new Date(c.date + "T23:59:59");
    return clashDate >= new Date();
  });
}

const SYSTEM_PROMPT = `You are Campus Buddy, a friendly and helpful AI assistant for CampusSync — a college campus information platform.

Your job is to answer users' questions about campus information using ONLY the real-time data provided to you in the context below. You are grounded in this data — do not make up information that isn't in the context.

## Role Awareness
The context provided to you is personalized based on the authenticated user's role (Student, Society Admin, or College Admin). The data you receive is what that role is entitled to see. Do NOT reference or suggest data types that are not present in the context. For example, if no timetable or class information is provided, do not mention classes or suggest checking a personal timetable. Answer based only on the sections actually included in the context.

If the student has selected interests, prioritize events, notices, and announcements whose target interests overlap with the student's interests when answering questions like "What opportunities are relevant to me?", "What should I check out?", or "What's happening this week?". Only recommend items that actually exist in the provided context — do not hallucinate. If no content matches the student's interests, say so honestly.

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
8. When answering questions about schedule clashes or conflicts, use ONLY the "EXISTING DETECTED SCHEDULE CLASHES" section from the context. Do NOT independently calculate or determine whether two events clash — rely entirely on the pre-calculated clash data provided. If clashes are listed, report them accurately. If no clashes are listed, say there are no detected clashes. Never contradict the provided clash data.

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
    const userRole = (profile?.role || "student").toLowerCase();
    const isStudent = userRole === "student";
    const isSocietyAdmin = userRole === "society_admin";
    const isCollegeAdmin = userRole === "college_admin";

    // Common queries for all roles
    const commonQueries = [
      supabaseAdmin.from("notices").select("title, description, date, department, deadline, target_interests").order("date", { ascending: false }).limit(5),
      supabaseAdmin.from("events").select("title, description, date, start_time, end_time, location, organizer, target_interests").gte("date", today).order("date").limit(5),
      supabaseAdmin.from("events").select("id, title, description, date, start_time, end_time, location, organizer, target_interests").order("date"),
    ];

    // Announcements: all roles see announcements, but society admin sees their own society's prominently
    let announcementQuery = supabaseAdmin.from("announcements").select("title, content, society_name, date, event_date, event_time, registration_deadline, event_location, target_interests").order("date", { ascending: false }).limit(5);
    if (isSocietyAdmin && profile?.society_name) {
      announcementQuery = supabaseAdmin.from("announcements").select("title, content, society_name, date, event_date, event_time, registration_deadline, event_location, target_interests").eq("society_name", profile.society_name).order("date", { ascending: false }).limit(5);
    }
    commonQueries.push(announcementQuery);

    // All announcements for clash detection (students only need this)
    if (isStudent) {
      commonQueries.push(
        supabaseAdmin.from("announcements").select("id, title, content, society_name, date, event_date, event_time, registration_deadline, event_location, target_interests").order("date", { ascending: false })
      );
      commonQueries.push(
        supabaseAdmin.from("classes").select("id, subject, day_of_week, date, start_time, end_time, room").eq("user_id", userId).order("start_time")
      );
    }

    const results = await Promise.all(commonQueries);
    const noticesRes = results[0];
    const eventsRes = results[1];
    const allEventsRes = results[2];
    const announcementsRes = results[3];

    // Student-specific data
    let crUpdatesRes: { data: any[] | null } = { data: null };
    let classesRes: { data: any[] | null } = { data: null };
    let notificationsRes: { data: any[] | null } = { data: null };
    let allAnnouncementsRes: { data: any[] | null } = { data: null };
    let allClassesRes: { data: any[] | null } = { data: null };
    let detectedClashes: ClashDetail[] = [];

    if (isStudent) {
      allAnnouncementsRes = results[4];
      allClassesRes = results[5];

      const studentQueries = await Promise.all([
        profile?.branch && profile?.year && profile?.section
          ? supabaseAdmin.from("cr_updates").select("*").eq("branch", profile.branch).eq("year", profile.year).eq("section", profile.section).order("date", { ascending: false }).limit(5)
          : supabaseAdmin.from("cr_updates").select("*").order("date", { ascending: false }).limit(5),
        supabaseAdmin.from("classes").select("subject, day_of_week, start_time, end_time, room").eq("user_id", userId).order("start_time"),
        supabaseAdmin.from("notifications").select("title, description, read, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      ]);
      crUpdatesRes = studentQueries[0];
      classesRes = studentQueries[1];
      notificationsRes = studentQueries[2];

      const allEvents: ServerEventEntry[] = (allEventsRes.data as ServerEventEntry[]) || [];
      const allAnnouncements: ServerAnnouncement[] = (allAnnouncementsRes.data as ServerAnnouncement[]) || [];
      const allClasses: ServerClassEntry[] = (allClassesRes.data as ServerClassEntry[]) || [];
      detectedClashes = detectClashes(allClasses, allEvents, allAnnouncements);
    }

    const contextParts: string[] = [];

    // Role-specific profile context
    if (isStudent) {
      contextParts.push(`## Student Profile
- Name: ${profile?.full_name || "Unknown"}
- Department: ${profile?.department || "General"}
- Branch: ${profile?.branch || "Not set"}
- Year: ${profile?.year || "Not set"}
- Section: ${profile?.section || "Not set"}
- Interests: ${(profile?.interests && profile.interests.length > 0) ? profile.interests.join(", ") : "None selected"}
- Today: ${todayName}, ${today}`);
    } else if (isSocietyAdmin) {
      contextParts.push(`## Society Admin Profile
- Name: ${profile?.full_name || "Unknown"}
- Role: Society Admin
- Society: ${profile?.society_name || "Not set"}
- Department: ${profile?.department || "General"}
- Today: ${todayName}, ${today}`);
    } else if (isCollegeAdmin) {
      contextParts.push(`## College Admin Profile
- Name: ${profile?.full_name || "Unknown"}
- Role: College Admin
- Department: ${profile?.department || "General"}
- Today: ${todayName}, ${today}`);
    }

    // Notices — all roles
    if (noticesRes.data && noticesRes.data.length > 0) {
      const noticeText = noticesRes.data.map((n: any) =>
        `- ${n.title} | Dept: ${n.department} | Date: ${n.date}${n.deadline ? ` | Deadline: ${n.deadline}` : ""}${n.target_interests && n.target_interests.length > 0 ? ` | Target Interests: ${n.target_interests.join(", ")}` : ""} | ${n.description}`
      ).join("\n");
      contextParts.push(`## Latest Notices\n${noticeText}`);
    } else {
      contextParts.push("## Latest Notices\nNo notices found.");
    }

    // Announcements — all roles (filtered for society admin)
    if (announcementsRes.data && announcementsRes.data.length > 0) {
      const annText = announcementsRes.data.map((a: any) =>
        `- ${a.title} by ${a.society_name} | Date: ${a.date}${a.event_date ? ` | Event Date: ${a.event_date}` : ""}${a.event_time ? ` at ${a.event_time}` : ""}${a.event_location ? ` | Location: ${a.event_location}` : ""}${a.registration_deadline ? ` | Registration Deadline: ${a.registration_deadline}` : ""}${a.target_interests && a.target_interests.length > 0 ? ` | Target Interests: ${a.target_interests.join(", ")}` : ""} | ${a.content}`
      ).join("\n");
      const sectionTitle = isSocietyAdmin ? `## Latest Announcements (for ${profile?.society_name || "your society"})` : "## Latest Society Announcements";
      contextParts.push(`${sectionTitle}\n${annText}`);
    } else {
      const sectionTitle = isSocietyAdmin ? `## Latest Announcements (for ${profile?.society_name || "your society"})` : "## Latest Society Announcements";
      contextParts.push(`${sectionTitle}\nNo announcements found.`);
    }

    // Events — all roles
    if (eventsRes.data && eventsRes.data.length > 0) {
      const eventText = eventsRes.data.map((e: any) =>
        `- ${e.title} on ${e.date} from ${e.start_time} to ${e.end_time} at ${e.location} | Organizer: ${e.organizer}${e.target_interests && e.target_interests.length > 0 ? ` | Target Interests: ${e.target_interests.join(", ")}` : ""} | ${e.description}`
      ).join("\n");
      contextParts.push(`## Upcoming Events\n${eventText}`);
    } else {
      contextParts.push("## Upcoming Events\nNo upcoming events found.");
    }

    // Student-only sections: CR updates, timetable, notifications, clashes
    if (isStudent) {
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
        const allClassesText = classesRes.data.map((c: any) => `- ${c.day_of_week}: ${c.subject} from ${c.start_time} to ${c.end_time} in Room ${c.room}`).join("\n");
        contextParts.push(`## Full Weekly Timetable\n${allClassesText}`);
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

      if (detectedClashes.length > 0) {
        const clashText = detectedClashes.map((c) =>
          `- ${c.message}\n  Item A: ${c.activityA.label} | Date: ${c.activityA.date} | Time: ${c.activityA.start} to ${c.activityA.end}\n  Item B: ${c.activityB.label} | Date: ${c.activityB.date} | Time: ${c.activityB.start} to ${c.activityB.end}\n  Calculated Overlap: ${c.overlapStart} to ${c.overlapEnd}`
        ).join("\n");
        contextParts.push(`## EXISTING DETECTED SCHEDULE CLASHES\n${clashText}`);
      } else {
        contextParts.push("## EXISTING DETECTED SCHEDULE CLASHES\nNo schedule clashes detected.");
      }
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
      parts: [{ text: `## Campus Data (Real-Time)\n${contextBlock}\n\n## User Question\n${query}` }],
    });

    const geminiBody = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    let geminiResponse: Response | null = null;
    let lastErrText = "";
    let lastErrStatus = 0;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      geminiResponse = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });

      if (geminiResponse.ok) break;

      lastErrText = await geminiResponse.text();
      lastErrStatus = geminiResponse.status;

      const isTransient = geminiResponse.status === 503 || geminiResponse.status === 504 || lastErrText.includes("UNAVAILABLE");
      if (!isTransient || attempt === MAX_RETRIES) break;

      console.error(`Gemini transient error (attempt ${attempt + 1}/${MAX_RETRIES + 1}), status ${geminiResponse.status}: ${lastErrText.slice(0, 200)}`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * (attempt + 1)));
    }

    if (!geminiResponse || !geminiResponse.ok) {
      console.error(`Gemini API failed after retries, final status ${lastErrStatus}: ${lastErrText.slice(0, 500)}`);
      const userMsg = lastErrStatus === 503 || lastErrStatus === 504
        ? "The AI assistant is temporarily unavailable due to high demand. Please try again in a moment."
        : "The AI assistant encountered an error. Please try again later.";
      return new Response(
        JSON.stringify({ error: userMsg }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
