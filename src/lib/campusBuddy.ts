import { supabase } from './supabase';
import type { Profile } from './supabase';

export interface BuddyResponse {
  text: string;
  action?: {
    path: string;
    highlight: string;
    label: string;
  };
  quickLinks?: { label: string; path: string; highlight: string }[];
}

export interface HistoryMessage {
  role: 'user' | 'buddy';
  text: string;
}

const WELCOME_TEXT = `Welcome to CampusSync! \u{1F44B} CampusSync brings your college and society information together in one place, so you don't have to search through multiple messages and platforms. Check the Notices section for official college updates, Announcements for society updates, Events for upcoming opportunities, Notifications for important alerts, and Timetable for your classes, deadlines, and clash information. You can also check Class Representative Updates for last-minute class changes and use Campus Buddy whenever you need help navigating the website.`;

const WELCOME_LINKS = [
  { label: 'Notices', path: '/notices', highlight: 'latest-notice' },
  { label: 'Society Announcements', path: '/announcements', highlight: 'latest-announcement' },
  { label: 'Events', path: '/events', highlight: 'upcoming-events' },
  { label: 'Notifications', path: '/dashboard', highlight: 'notifications' },
  { label: 'Timetable', path: '/timetable', highlight: 'clashes' },
  { label: 'Class Representative Updates', path: '/dashboard', highlight: 'cr-updates' },
];

const COMMON_QUESTIONS = [
  { label: 'New Here?' },
] as const;

export function getRoleAwareQuestions(profile: Profile | null): { label: string }[] {
  if (!profile) {
    return [
      { label: 'What is CampusSync?' },
      { label: 'What events are happening this week?' },
      { label: 'What new notices are there?' },
    ];
  }

  switch (profile.role) {
    case 'student': {
      const base = [
        { label: "What's important today?" },
        { label: 'What deadlines are coming up?' },
        { label: 'What events are happening this week?' },
        { label: 'What did I miss this week?' },
        { label: "Are there any opportunities for me?" },
        { label: "What's new?" },
      ];
      if (profile.student_type === 'cr') {
        base.push(
          { label: 'What class updates were posted?' },
          { label: 'Are there any recent updates for my class?' },
        );
      }
      return base;
    }
    case 'society_admin':
      return [
        { label: 'What events are happening this week?' },
        { label: 'What upcoming campus activities are there?' },
        { label: 'What important college notices are there?' },
        { label: 'Are there any upcoming deadlines?' },
        { label: "What's new on campus?" },
      ];
    case 'college_admin':
      return [
        { label: 'What are the latest official notices?' },
        { label: 'What upcoming events are scheduled?' },
        { label: 'What important deadlines are coming up?' },
        { label: 'What recent announcements were posted?' },
        { label: 'Are there any pending updates I should know about?' },
      ];
    case 'primary_admin':
      return [
        { label: 'What are the latest official notices?' },
        { label: 'What upcoming events are scheduled?' },
        { label: 'Are there any pending administrator requests?' },
        { label: 'What recent campus announcements are there?' },
        { label: 'What important updates should I know about?' },
      ];
    default:
      return [
        { label: 'What events are happening this week?' },
        { label: 'What new notices are there?' },
        { label: "What's new?" },
      ];
  }
}

const FALLBACK_RESPONSE: BuddyResponse = {
  text: `I'm having trouble connecting to the AI assistant right now. Here are some quick links you can use directly:`,
  quickLinks: WELCOME_LINKS,
};

function unwrapBuddyResponse(data: { text?: unknown; [key: string]: unknown }): { text?: unknown; [key: string]: unknown } {
  if (typeof data.text !== 'string') return data;

  const fencedJson = data.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fencedJson?.[1] || data.text).trim();
  const objectStart = candidate.indexOf('{');
  const objectEnd = candidate.lastIndexOf('}');

  if (objectStart < 0 || objectEnd <= objectStart) return data;

  try {
    const parsed: unknown = JSON.parse(candidate.slice(objectStart, objectEnd + 1));
    if (parsed && typeof parsed === 'object' && 'text' in parsed) {
      return { ...data, ...(parsed as Record<string, unknown>) };
    }
  } catch {
    return data;
  }

  return data;
}

export async function getBuddyResponse(
  query: string,
  profile: Profile | null,
  history?: HistoryMessage[],
): Promise<BuddyResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { text: 'Hi! Ask me anything about CampusSync \u2014 try "Where are my notices?" or click a question below.' };
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes('new here') || lower.includes('getting started') || lower.includes('what is campus') || lower.includes('what is this') || lower.includes('help me') || lower.includes('guide')) {
    return { text: WELCOME_TEXT, quickLinks: WELCOME_LINKS };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      return FALLBACK_RESPONSE;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campus-buddy-ai`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: trimmed,
          history: (history || []).slice(-8).map((m) => ({ role: m.role, text: m.text })),
        }),
      },
    );

    if (!response.ok) {
      console.error('Campus Buddy AI error:', response.status);
      return FALLBACK_RESPONSE;
    }

    const data = unwrapBuddyResponse(await response.json());

    if (data.error) {
      console.error('Campus Buddy AI returned error:', data.error);
      return FALLBACK_RESPONSE;
    }

    const result: BuddyResponse = { text: typeof data.text === 'string' ? data.text : 'I could not generate a response. Please try again.' };
    if (data.action && typeof data.action === 'object' && 'path' in data.action && 'label' in data.action) {
      const action = data.action as { path: string; highlight?: string; label: string };
      result.action = {
        path: action.path,
        highlight: action.highlight || '',
        label: action.label,
      };
    }
    if (Array.isArray(data.quickLinks) && data.quickLinks.length > 0) {
      result.quickLinks = data.quickLinks
        .filter((ql: unknown): ql is { label: string; path: string; highlight?: string } => Boolean(ql && typeof ql === 'object' && 'label' in ql && 'path' in ql))
        .map((ql) => ({ label: ql.label, path: ql.path, highlight: ql.highlight || '' }));
    }
    return result;
  } catch (err) {
    console.error('Campus Buddy fetch failed:', err);
    return FALLBACK_RESPONSE;
  }
}

export { COMMON_QUESTIONS, WELCOME_TEXT, WELCOME_LINKS };
