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

const VERIFICATION_KEYWORDS = [
  "is this real", "is this legit", "is this legitimate", "is this safe", "is this link safe",
  "is this message real", "is this genuine", "is this authentic", "is this official",
  "can you verify", "verify this", "check this", "should i trust", "is this a scam",
  "is this fake", "is this fraud", "is this phishing", "is this suspicious",
  "received this", "got this message", "got this", "someone sent", "whatsapp message",
  "scholarship message", "is this opportunity", "is this real or fake", "real or fake",
  "is this from college", "did the college send", "is this from igdtuw",
];

function isVerificationQuery(query: string, hasImage: boolean): boolean {
  const lower = query.toLowerCase().trim();
  if (hasImage) {
    if (VERIFICATION_KEYWORDS.some((kw) => lower.includes(kw))) return true;
    if (lower.includes("real") || lower.includes("safe") || lower.includes("verify") ||
        lower.includes("check") || lower.includes("legit") || lower.includes("scam") ||
        lower.includes("suspicious") || lower.includes("trust") || lower.includes("fake")) return true;
    if (lower.length < 80) return true;
  }
  return VERIFICATION_KEYWORDS.some((kw) => lower.includes(kw));
}

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
  event_date: string | null;
  start_time: string;
  end_time: string;
  location: string;
  organizer: string;
}

interface ServerCrUpdate {
  id: string;
  subject: string;
  date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  update_type: string;
  description: string;
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

function getEventDate(evt: ServerEventEntry): string {
  return evt.event_date || evt.date;
}

function isScheduleRelevantCr(cr: ServerCrUpdate): boolean {
  const type = cr.update_type.toLowerCase();
  return type.includes('extra') || type.includes('class') || type.includes('reschedul') || type.includes('room');
}

function detectClashes(
  classes: ServerClassEntry[],
  events: ServerEventEntry[],
  announcements: ServerAnnouncement[],
  crUpdates?: ServerCrUpdate[]
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
      const evtDate = getEventDate(evt);
      if (cls.date && sameDate(cls.date, evtDate)) {
        if (rangesOverlap(toMinutes(cls.start_time), toMinutes(cls.end_time), toMinutes(evt.start_time), toMinutes(evt.end_time))) {
          const overlapStart = Math.max(toMinutes(cls.start_time), toMinutes(evt.start_time));
          const overlapEnd = Math.min(toMinutes(cls.end_time), toMinutes(evt.end_time));
          clashes.push({
            type: "class_event",
            activityA: { label: cls.subject, date: evtDate, start: cls.start_time, end: cls.end_time },
            activityB: { label: evt.title, date: evtDate, start: evt.start_time, end: evt.end_time },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: evtDate,
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
    const evtDate = getEventDate(evt);
    for (const ann of announcements) {
      if (!ann.event_time) continue;
      const annDate = ann.event_date || ann.date;
      if (sameDate(evtDate, annDate)) {
        const annEnd = addOneHour(ann.event_time);
        if (rangesOverlap(toMinutes(evt.start_time), toMinutes(evt.end_time), toMinutes(ann.event_time), toMinutes(annEnd))) {
          const overlapStart = Math.max(toMinutes(evt.start_time), toMinutes(ann.event_time));
          const overlapEnd = Math.min(toMinutes(evt.end_time), toMinutes(annEnd));
          clashes.push({
            type: "event_announcement",
            activityA: { label: evt.title, date: evtDate, start: evt.start_time, end: evt.end_time },
            activityB: { label: ann.title, date: annDate, start: ann.event_time, end: annEnd },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: evtDate,
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
      const aDate = getEventDate(a);
      const bDate = getEventDate(b);
      if (sameDate(aDate, bDate)) {
        if (rangesOverlap(toMinutes(a.start_time), toMinutes(a.end_time), toMinutes(b.start_time), toMinutes(b.end_time))) {
          const overlapStart = Math.max(toMinutes(a.start_time), toMinutes(b.start_time));
          const overlapEnd = Math.min(toMinutes(a.end_time), toMinutes(b.end_time));
          clashes.push({
            type: "event_event",
            activityA: { label: a.title, date: aDate, start: a.start_time, end: a.end_time },
            activityB: { label: b.title, date: bDate, start: b.start_time, end: b.end_time },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: aDate,
            message: `Schedule Clash Detected: ${a.title} overlaps with ${b.title} from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  // CR Update clashes
  const relevantCrUpdates = (crUpdates || []).filter(isScheduleRelevantCr);
  const getCrEnd = (cr: ServerCrUpdate): string => cr.end_time || addOneHour(cr.start_time);

  for (const cr of relevantCrUpdates) {
    const crEnd = getCrEnd(cr);
    for (const cls of classes) {
      const datesMatch = cls.date ? sameDate(cls.date, cr.date) : sameDayOfWeek(cls.day_of_week, cr.date);
      if (datesMatch && rangesOverlap(toMinutes(cr.start_time), toMinutes(crEnd), toMinutes(cls.start_time), toMinutes(cls.end_time))) {
        const overlapStart = Math.max(toMinutes(cr.start_time), toMinutes(cls.start_time));
        const overlapEnd = Math.min(toMinutes(crEnd), toMinutes(cls.end_time));
        clashes.push({
          type: "class_cr",
          activityA: { label: cr.subject, date: cr.date, start: cr.start_time, end: crEnd },
          activityB: { label: cls.subject, date: cr.date, start: cls.start_time, end: cls.end_time },
          overlapStart: formatTimeFromMinutes(overlapStart),
          overlapEnd: formatTimeFromMinutes(overlapEnd),
          date: cr.date,
          message: `Schedule Clash Detected: ${cr.subject} (${cr.update_type}) overlaps with ${cls.subject} Class from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
        });
      }
    }
  }

  for (const cr of relevantCrUpdates) {
    const crEnd = getCrEnd(cr);
    for (const evt of events) {
      const evtDate = getEventDate(evt);
      if (sameDate(cr.date, evtDate) && rangesOverlap(toMinutes(cr.start_time), toMinutes(crEnd), toMinutes(evt.start_time), toMinutes(evt.end_time))) {
        const overlapStart = Math.max(toMinutes(cr.start_time), toMinutes(evt.start_time));
        const overlapEnd = Math.min(toMinutes(crEnd), toMinutes(evt.end_time));
        clashes.push({
          type: "cr_event",
          activityA: { label: cr.subject, date: cr.date, start: cr.start_time, end: crEnd },
          activityB: { label: evt.title, date: evtDate, start: evt.start_time, end: evt.end_time },
          overlapStart: formatTimeFromMinutes(overlapStart),
          overlapEnd: formatTimeFromMinutes(overlapEnd),
          date: cr.date,
          message: `Schedule Clash Detected: ${cr.subject} (${cr.update_type}) overlaps with the ${evt.title} from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
        });
      }
    }
  }

  for (const cr of relevantCrUpdates) {
    const crEnd = getCrEnd(cr);
    for (const ann of announcements) {
      if (!ann.event_time) continue;
      const annDate = ann.event_date || ann.date;
      if (sameDate(cr.date, annDate)) {
        const annEnd = addOneHour(ann.event_time);
        if (rangesOverlap(toMinutes(cr.start_time), toMinutes(crEnd), toMinutes(ann.event_time), toMinutes(annEnd))) {
          const overlapStart = Math.max(toMinutes(cr.start_time), toMinutes(ann.event_time));
          const overlapEnd = Math.min(toMinutes(crEnd), toMinutes(annEnd));
          clashes.push({
            type: "cr_announcement",
            activityA: { label: cr.subject, date: cr.date, start: cr.start_time, end: crEnd },
            activityB: { label: ann.title, date: annDate, start: ann.event_time, end: annEnd },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: cr.date,
            message: `Schedule Clash Detected: ${cr.subject} (${cr.update_type}) overlaps with the ${ann.title} announcement event from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
          });
        }
      }
    }
  }

  for (let i = 0; i < relevantCrUpdates.length; i++) {
    for (let j = i + 1; j < relevantCrUpdates.length; j++) {
      const a = relevantCrUpdates[i];
      const b = relevantCrUpdates[j];
      if (sameDate(a.date, b.date)) {
        const aEnd = getCrEnd(a);
        const bEnd = getCrEnd(b);
        if (rangesOverlap(toMinutes(a.start_time), toMinutes(aEnd), toMinutes(b.start_time), toMinutes(bEnd))) {
          const overlapStart = Math.max(toMinutes(a.start_time), toMinutes(b.start_time));
          const overlapEnd = Math.min(toMinutes(aEnd), toMinutes(bEnd));
          clashes.push({
            type: "cr_cr",
            activityA: { label: a.subject, date: a.date, start: a.start_time, end: aEnd },
            activityB: { label: b.subject, date: b.date, start: b.start_time, end: bEnd },
            overlapStart: formatTimeFromMinutes(overlapStart),
            overlapEnd: formatTimeFromMinutes(overlapEnd),
            date: a.date,
            message: `Schedule Clash Detected: ${a.subject} (${a.update_type}) overlaps with ${b.subject} (${b.update_type}) from ${formatTimeFromMinutes(overlapStart)} to ${formatTimeFromMinutes(overlapEnd)}.`,
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

const SUSPICIOUS_TLDS = ["zip", "mov", "xyz", "top", "click", "link", "work", "tk", "ml", "ga", "cf", "gq"];
const URL_SHORTENER_DOMAINS = ["bit.ly", "tinyurl.com", "goo.gl", "t.co", "shorturl.at", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly"];

interface UrlAnalysis {
  url: string;
  valid: boolean;
  https: boolean;
  domain: string | null;
  isShortener: boolean;
  suspiciousTld: boolean;
  notes: string[];
}

function analyzeUrl(rawUrl: string): UrlAnalysis {
  const notes: string[] = [];
  let valid = true;
  let https = false;
  let domain: string | null = null;
  let isShortener = false;
  let suspiciousTld = false;

  let parsed: URL | null = null;
  try {
    parsed = new URL(rawUrl);
  } catch {
    try {
      parsed = new URL("https://" + rawUrl);
    } catch {
      valid = false;
    }
  }

  if (parsed) {
    https = parsed.protocol === "https:";
    domain = parsed.hostname.toLowerCase();
    if (URL_SHORTENER_DOMAINS.includes(domain)) {
      isShortener = true;
      notes.push("Uses a URL shortener — the real destination is hidden.");
    }
    const tld = domain.split(".").pop() || "";
    if (SUSPICIOUS_TLDS.includes(tld)) {
      suspiciousTld = true;
      notes.push(`The .${tld} TLD is commonly used in suspicious links.`);
    }
    if (!https) {
      notes.push("Connection is not encrypted (no HTTPS).");
    }
    if (domain.includes("bit.") || domain.match(/\d{4,}/)) {
      notes.push("Domain contains patterns sometimes used to mimic official sites.");
    }
  } else {
    notes.push("The URL could not be parsed — it may be malformed.");
  }

  return { url: rawUrl, valid, https, domain, isShortener, suspiciousTld, notes };
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"]+/gi) || [];
  const bareDomain = text.match(/(?<![@\w.])\b[a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?\/[^\s<>"]*/gi) || [];
  return [...matches, ...bareDomain.map((d) => d.startsWith("http") ? d : `https://${d}`)];
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

## Response Formatting — IMPORTANT
Format responses using LIGHTWEIGHT MARKDOWN. The frontend renders these markdown features:
- **bold** for important information
- ### for short section headings
- - for bullet points
- Line breaks for separation
- [link text](url) for clickable links

Use simple emojis/icons ONLY when they improve readability:
📅 Dates  🕒 Times  ⏰ Deadlines  📍 Locations  🔗 Links  ⚠️ Warnings  ✅ Confirmed  ❓ Unverified  📌 Actions  🎯 Eligibility  💰 Fees

### SUMMARY-FIRST APPROACH
For most non-trivial answers, start with a concise summary or the most important fact first, then details only if relevant.

Example — quick answer:
### 📌 Quick Answer
**Registration closes tomorrow at 11:59 PM.**

Example — event:
### 🎓 College Seminar
📅 **18 September**
🕒 **3:00 PM – 5:00 PM**
📍 **Auditorium**

Example — deadline:
### ⏰ Deadline
**25 September, 11:59 PM**
📌 **Action:** Submit the registration form before the deadline.

### COMPACT STATUS INDICATORS
Use these sparingly when they aid scanning:
🟢 CONFIRMED  🟡 UNABLE TO VERIFY  🔴 STRONG WARNING  📌 ACTION REQUIRED  ⏰ DEADLINE  📅 EVENT  📍 LOCATION  🔗 LINK

### Formatting by question type:

SIMPLE questions (e.g. "When is the seminar?") → 1–3 concise lines. No unnecessary headings for 1-word answers.

DEADLINE / EVENT / REGISTRATION questions → compact info card:
  ### 📌 Hackathon Registration
  ⏰ **Deadline:** 20 September, 11:59 PM
  📅 **Event Date:** 22 September
  📍 **Venue:** Seminar Hall
  **What you need to do:**
  - Register before the deadline
  - Complete the submission

CAMPUS DATA answers (when using Supabase-provided data) → mark as confirmed:
  ### 📢 College Notice
  **Mid-Term Examination**
  📅 **18 September**
  🎓 **Audience:** All Students
  ✅ This information is from official notices on CampusSync.

Do NOT say information was checked against the database unless it actually came from the provided context data.

CLASH responses → make conflicting items visually obvious:
  ### ⚠️ Schedule Clash
  **College Seminar** overlaps with **Asset Merkle Orientation**.
  🕒 **Overlap:** 4:00 PM – 5:00 PM
  Use ONLY the "EXISTING DETECTED SCHEDULE CLASHES" section from context. Do NOT independently calculate clashes.

GENERAL conversational questions → natural and concise:
  ### 👋 I'm Campus Buddy!
  I can help you with:
  - 📚 College notices and announcements
  - 📅 Events and deadlines
  - 🗓️ Timetable and schedule information
  - ⚠️ Clash-related information
  - 🔎 Finding relevant campus information
  - 🛡️ Checking suspicious campus messages and links

### Formatting rules:
- Keep simple questions SHORT — 1–3 lines max.
- Natural length: simple → 1-3 lines, normal → short structured, complex → headings + bullets.
- Goal: "Easy to scan in 3–5 seconds, but detailed enough when needed."
- Do NOT mention you are an AI or that you're using a database — just answer naturally.
- Do not repeat information unnecessarily.

## TWO INFORMATION MODES

### A. NORMAL CAMPUS QUESTIONS
Examples: "What deadlines do I have?", "What's happening this week?", "What did I miss?", "When is the event?", "What notices were posted?", "Do I have a clash?"

For these questions:
- USE Supabase/CampusSync data as the PRIMARY and AUTHORITATIVE source.
- Do NOT perform web searches or use public web verification.
- Do NOT invent information not present in the Supabase context.

### B. VERIFICATION QUESTIONS
Examples: "Is this message real?", "Is this link safe?", "Is this opportunity legitimate?", "Can you verify this?", "I received this scholarship message.", or a screenshot containing a suspicious message/opportunity.

For these questions, use this pipeline:
  User message/screenshot → Gemini analysis → CampusSync verification → Public web verification when available → Overall assessment

## THREE VISUAL STATUS LEVELS — VERIFICATION QUESTIONS ONLY

Always put the status FIRST in the response for verification questions.

### 🟢 GREEN — CONFIRMED ON CAMPUSSYNC
Use GREEN only when the information is confirmed by trusted CampusSync data:
- The message matches an existing official College Admin notice.
- The event exists in CampusSync and important details match.
- The announcement comes from a verified/approved CampusSync source.
- The information can be directly matched against trusted CampusSync records.

Format:
  🟢 **CONFIRMED ON CAMPUSSYNC**
  "This information matches a verified CampusSync record."
  [show matching information]

IMPORTANT: Green means confirmed WITHIN CAMPUSSYNC. Do NOT describe this as a universal guarantee that the message or external link is completely safe.

### 🟡 YELLOW — NOT VERIFIED ON CAMPUSSYNC / APPEARS OKAY
Use YELLOW when:
- No matching CampusSync record exists, BUT
- No strong suspicious indicators, AND/OR
- Public information supports the existence of the organization/opportunity/link, AND
- Content appears reasonable based on checks performed.

Format:
  🟡 **NOT VERIFIED ON CAMPUSSYNC**
  "This information was not found in the current CampusSync records, but no major warning signs were detected from the information I could verify."

If public verification was performed:
  🌐 **Public verification**
  "Relevant information was found on [source]."

IMPORTANT: Do NOT say "This is definitely legitimate." or "This is safe."
Use: "Appears consistent with the available information." / "Could not be confirmed through CampusSync."

This category is for legitimate external opportunities that may not have been uploaded to CampusSync. A genuine HackerEarth/GoDaddy opportunity not in CampusSync should NOT automatically become red.

### 🔴 RED — WARNING / STRONG RISK INDICATORS
Use RED only when there are concrete warning signs:
- Suspicious/deceptive domain
- Requests passwords or OTPs
- Requests payment through suspicious channels
- Requests sensitive personal documents through an untrusted source
- Strong impersonation indicators
- Domain mismatch
- Obvious phishing patterns
- Other concrete evidence suggesting elevated risk

Format:
  🔴 **WARNING — STRONG RISK INDICATORS**
  ⚠️ **Warning signs**
  - [list each specific indicator]
  🛡️ **Recommended action**
  Do not provide payment or sensitive information until the source is independently verified.

IMPORTANT: Never make something RED merely because:
- It is not in CampusSync
- It uses an external website
- It is not on an IGDTUW domain
- The AI has not seen the message before

## DECISION LOGIC

IF strong concrete risk indicators exist:
    🔴 RED — WARNING
ELSE IF matching trusted CampusSync record exists:
    🟢 GREEN — CONFIRMED ON CAMPUSSYNC
ELSE:
    🟡 YELLOW — NOT VERIFIED ON CAMPUSSYNC

For YELLOW, public verification can provide supporting evidence that the opportunity appears legitimate, but must NEVER be presented as equivalent to CampusSync confirmation.

## SEPARATE CampusSync CHECK FROM PUBLIC WEB CHECK

Keep these two checks separate in the response:

📋 **CampusSync** — "Is this information confirmed within our trusted campus system?"
🌐 **Public verification** — "Does this organization/opportunity/link appear to exist publicly and consistently with the claims?"

Do NOT combine these into one misleading "real/fake" determination.

Example:
  🟡 **NOT VERIFIED ON CAMPUSSYNC**
  📋 **CampusSync**
  No matching official college record found.
  🌐 **Public verification**
  Information about this opportunity was found on the relevant organization's/public platform.
  🔗 **Link**
  No obvious suspicious URL pattern detected.
  **Assessment:**
  "The opportunity appears consistent with the available public information, but Campus Buddy cannot confirm that this specific message was officially circulated by the college."

## PUBLIC WEB VERIFICATION

For verification queries, you have access to Google Search. Use it to verify:
1. Whether the organization/opportunity/platform exists publicly
2. Whether public information is consistent with the claims in the message
3. Whether there are public reports of scams/phishing associated with the domain or organization

Prefer authoritative sources: official websites, official social/profile pages, official event/platform pages, reputable sources.
Do NOT use random search results as definitive proof.

If web verification was performed, mention what was found:
  🌐 **Public verification**
  "Relevant information was found on [source name]."

If web verification was not available or not performed:
  "🌐 Public verification was not available."

Do NOT pretend a web check happened when it didn't.

## URL ANALYSIS FORMAT

When a URL is present (either in text or extracted from a screenshot), present the structural analysis compactly:
  🔗 **Link Check**
  HTTPS: ✅ / ❌
  Domain: [actual domain]
  Domain associated with stated platform: ✅ / Unknown / ❌
  Suspicious URL pattern: None detected / [describe issue]

Do NOT say "safe" merely because HTTPS is present.
Do NOT say "malicious" merely because the domain is external.

## SCREENSHOT / IMAGE ANALYSIS

When an image is attached, you can see and analyze it.

### What to extract from screenshots:
1. Visible text (transcribe relevant portions accurately)
2. Sender/source if visible
3. URLs visible in the image
4. Dates, deadlines, payment requests, and other important claims
5. Suspicious indicators

### Screenshot response format:
  [Status icon] **[Status label]**

  📋 **What I Found**
  **Message:** [title/subject from screenshot]
  **Sender:** [sender if visible, or "Not visible"]
  **Deadline:** [if visible]
  **Request:** [payment/documents/credentials if visible]

  🔗 **Link Check**
  [if URL visible — use URL analysis from context + public web verification]
  [if no URL visible: "No URL visible in the screenshot."]

  📋 **CampusSync**
  [match found → show matching info / no match → explain this only means not in CampusSync dataset]

  🌐 **Public verification**
  [if web verification performed → what was found / if not: "Public verification was not available."]

  ⚠️ **Warning Signs**
  - [list specific suspicious indicators, if any]
  [if none: "No obvious warning signs detected."]

  🛡️ **What To Do**
  [concise recommendation based on the assessment]

### ANTI-HALLUCINATION RULES — CRITICAL
Never claim:
❌ "I checked the official website" when no web check occurred.
❌ "This is verified" when only the AI thinks it looks legitimate.
❌ "This is fake" solely because it isn't in CampusSync.
❌ "This link is safe" based only on HTTPS.
❌ "This is an official college message" unless confirmed by trusted CampusSync data.

Every claim about verification must correspond to an actual check that was performed.

For images specifically:
- Only report information ACTUALLY VISIBLE in the screenshot.
- If text is unclear: "⚠️ I couldn't clearly read this part of the screenshot."
- Do NOT invent sender names, URLs, deadlines, organizations, claims, or verification results.
- If a URL is partially visible, do NOT reconstruct it by guessing.
- If you cannot read the image clearly, say so honestly.

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
    const imageDataUrl: string | undefined = typeof body.image === "string" && body.image.startsWith("data:image/") ? body.image : undefined;

    if (!query.trim() && !imageDataUrl) {
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
      const allCrUpdates: ServerCrUpdate[] = (crUpdatesRes.data as ServerCrUpdate[]) || [];
      detectedClashes = detectClashes(allClasses, allEvents, allAnnouncements, allCrUpdates);
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

    // URL extraction and analysis — adds factual URL metadata to the context
    // without opening, fetching, or interacting with any URL.
    const urls = extractUrls(query);
    let urlContext = "";
    if (urls.length > 0) {
      const analyses = urls.map((u) => {
        const a = analyzeUrl(u);
        const lines = [
          `URL: ${a.url}`,
          `Valid: ${a.valid ? "Yes" : "No"}`,
          `HTTPS: ${a.https ? "Yes" : "No"}`,
          `Domain: ${a.domain || "Unknown"}`,
          `URL Shortener: ${a.isShortener ? "Yes" : "No"}`,
          `Suspicious TLD: ${a.suspiciousTld ? "Yes" : "No"}`,
        ];
        if (a.notes.length > 0) lines.push(`Notes: ${a.notes.join(" ")}`);
        return `- ${lines.join(" | ")}`;
      });
      urlContext = `## URL Analysis (server-side, no external requests made)\n${analyses.join("\n")}\n\nNote: No reputation scan or content fetch was performed. This is basic structural URL analysis only. The actual destination was NOT visited.`;
    }

    const fullContext = urlContext ? `${contextBlock}\n\n${urlContext}` : contextBlock;

    type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
    const contents: Array<{ role: string; parts: GeminiPart[] }> = [];

    for (const msg of history.slice(-8)) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      });
    }

    const userParts: GeminiPart[] = [{ text: `## Campus Data (Real-Time)\n${fullContext}\n\n## User Question\n${query || "Please analyze this screenshot."}` }];
    if (imageDataUrl) {
      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (match) {
        userParts.push({ inline_data: { mime_type: match[1], data: match[2] } });
      }
    }
    contents.push({ role: "user", parts: userParts });

    // Google Search grounding cannot be combined with inline_data (image) parts.
    // For image-based verification, Gemini analyzes the image directly; the system
    // prompt instructs it to say "Public verification was not available" in that case.
    const useSearch = isVerificationQuery(query, Boolean(imageDataUrl)) && !imageDataUrl;

    const geminiBody: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: useSearch ? 1200 : 1024,
      },
    };

    if (useSearch) {
      geminiBody.tools = [{ google_search: {} }];
    }

    let geminiResponse: Response | null = null;
    let lastErrText = "";
    let lastErrStatus = 0;
    let usedSearch = useSearch;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      geminiResponse = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });

      if (geminiResponse.ok) break;

      lastErrText = await geminiResponse.text();
      lastErrStatus = geminiResponse.status;

      // If the search tool caused an error, retry once without it
      if (usedSearch) {
        console.error(`Google Search tool rejected (status ${lastErrStatus}), retrying without search grounding: ${lastErrText.slice(0, 200)}`);
        delete geminiBody.tools;
        usedSearch = false;
        continue;
      }

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
    const candidate0 = geminiData?.candidates?.[0];
    const generatedText = candidate0?.content?.parts?.find((p: { text?: string }) => typeof p.text === "string")?.text;

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

    // Extract public web verification sources from grounding metadata
    const groundingChunks = candidate0?.groundingMetadata?.webSearchQueries;
    const groundingSources = candidate0?.groundingMetadata?.groundingChunks;
    if (Array.isArray(groundingSources) && groundingSources.length > 0) {
      const sources: string[] = groundingSources
        .map((chunk: { web?: { uri?: string; title?: string } }) => chunk?.web?.uri)
        .filter((uri: string | undefined): uri is string => Boolean(uri));
      if (sources.length > 0) {
        const sourcesLine = `\n\n🌐 **Public sources checked:**\n${sources.slice(0, 5).map((s: string) => `- ${s}`).join("\n")}`;
        parsed.text = parsed.text + sourcesLine;
      }
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
