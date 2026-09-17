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
  { label: 'Class Representative Updates' },
  { label: 'New Notices' },
  { label: 'Society Announcements' },
  { label: 'Upcoming Events' },
  { label: 'Clashes' },
  { label: 'Notifications' },
  { label: 'New Here?' },
] as const;

const FALLBACK_RESPONSE: BuddyResponse = {
  text: `I'm having trouble connecting to the AI assistant right now. Here are some quick links you can use directly:`,
  quickLinks: WELCOME_LINKS,
};

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

    const data = await response.json();

    if (data.error) {
      console.error('Campus Buddy AI returned error:', data.error);
      return FALLBACK_RESPONSE;
    }

    const result: BuddyResponse = { text: data.text || 'I could not generate a response. Please try again.' };
    if (data.action && data.action.path && data.action.label) {
      result.action = {
        path: data.action.path,
        highlight: data.action.highlight || '',
        label: data.action.label,
      };
    }
    if (Array.isArray(data.quickLinks) && data.quickLinks.length > 0) {
      result.quickLinks = data.quickLinks
        .filter((ql: any) => ql && ql.label && ql.path)
        .map((ql: any) => ({ label: ql.label, path: ql.path, highlight: ql.highlight || '' }));
    }
    return result;
  } catch (err) {
    console.error('Campus Buddy fetch failed:', err);
    return FALLBACK_RESPONSE;
  }
}

export { COMMON_QUESTIONS, WELCOME_TEXT, WELCOME_LINKS };
