import { supabase } from './supabase';
import type { EventEntry, Notice, Announcement, CrUpdate, ClassEntry, Notification } from './supabase';
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

const WELCOME_TEXT = `Welcome to CampusSync! \u{1F44B} CampusSync brings your college and society information together in one place, so you don't have to search through multiple messages and platforms. Check the Notices section for official college updates, Announcements for society updates, Events for upcoming opportunities, Notifications for important alerts, and Timetable for your classes, deadlines, and clash information. You can also check Class Representative Updates for last-minute class changes and use Campus Buddy \u{1F63B} whenever you need help navigating the website.`;

const WELCOME_LINKS = [
  { label: 'Notices', path: '/notices', highlight: 'latest-notice' },
  { label: 'Society Announcements', path: '/announcements', highlight: 'latest-announcement' },
  { label: 'Events', path: '/events', highlight: 'upcoming-events' },
  { label: 'Notifications', path: '/dashboard', highlight: 'notifications' },
  { label: 'Timetable', path: '/timetable', highlight: 'clashes' },
  { label: 'Class Representative Updates', path: '/dashboard', highlight: 'cr-updates' },
];

const COMMON_QUESTIONS = [
  { label: 'Class Representative Updates', keywords: ['cr', 'class representative', 'class update', 'cr update'] },
  { label: 'New Notices', keywords: ['notice', 'notices', 'new notice'] },
  { label: 'Society Announcements', keywords: ['society', 'announcement', 'announcements'] },
  { label: 'Upcoming Events', keywords: ['event', 'events', 'upcoming event'] },
  { label: 'Clashes', keywords: ['clash', 'clashes', 'schedule clash'] },
  { label: 'Notifications', keywords: ['notification', 'notifications', 'alert', 'alerts'] },
  { label: 'New Here?', keywords: ['new here', 'new', 'start', 'getting started', 'help', 'what is'] },
] as const;

function matchKeywords(query: string, keywords: string[]): boolean {
  const lower = query.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

async function fetchUpcomingEvents(): Promise<EventEntry[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('events').select('*').gte('date', today).order('date').limit(5);
  return data || [];
}

async function fetchLatestNotices(): Promise<Notice[]> {
  const { data } = await supabase.from('notices').select('*').order('date', { ascending: false }).limit(3);
  return data || [];
}

async function fetchLatestAnnouncements(): Promise<Announcement[]> {
  const { data } = await supabase.from('announcements').select('*').order('date', { ascending: false }).limit(3);
  return data || [];
}

async function fetchCrUpdates(profile: Profile | null): Promise<CrUpdate[]> {
  let query = supabase.from('cr_updates').select('*').order('date', { ascending: true });
  if (profile?.branch && profile?.year && profile?.section) {
    query = query.eq('branch', profile.branch).eq('year', profile.year).eq('section', profile.section);
  }
  const { data } = await query.limit(5);
  return data || [];
}

async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5);
  return data || [];
}

async function fetchClasses(): Promise<ClassEntry[]> {
  const { data } = await supabase.from('classes').select('*').order('start_time');
  return data || [];
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function getBuddyResponse(query: string, profile: Profile | null): Promise<BuddyResponse> {
  const lower = query.toLowerCase().trim();

  if (!lower) {
    return { text: 'Hi! Ask me anything about CampusSync \u{1F63B} \u2014 try "Where are my notices?" or click a question below.' };
  }

  if (matchKeywords(lower, ['new here', 'getting started', 'what is campus', 'what is this', 'how do i start', 'help me', 'guide'])) {
    return { text: WELCOME_TEXT, quickLinks: WELCOME_LINKS };
  }

  if (matchKeywords(lower, COMMON_QUESTIONS[0].keywords) || matchKeywords(lower, ['class rep', 'class change', 'class cancel', 'extra class', 'room change', 'reschedul'])) {
    const updates = await fetchCrUpdates(profile);
    if (updates.length === 0) {
      return {
        text: 'I couldn\u2019t find any Class Representative updates for your branch, year, and section right now. When a CR posts a class update (cancellation, room change, etc.), it\u2019ll appear here.',
        action: { path: '/dashboard', highlight: 'cr-updates', label: 'Go to Class Updates' },
      };
    }
    const summary = updates.slice(0, 3).map((u) => `\u2022 ${u.update_type} \u2014 ${u.subject} on ${formatDateShort(u.date)}${u.location ? ` at ${u.location}` : ''}`).join('\n');
    return {
      text: `Here are your latest Class Representative updates:\n${summary}`,
      action: { path: '/dashboard', highlight: 'cr-updates', label: 'View Class Updates' },
    };
  }

  if (matchKeywords(lower, COMMON_QUESTIONS[1].keywords) || matchKeywords(lower, ['where.*notice', 'find notice', 'see notice', 'college notice', 'official notice'])) {
    const notices = await fetchLatestNotices();
    if (notices.length === 0) {
      return {
        text: 'There are no notices published on CampusSync right now. Check back later or ask me again!',
        action: { path: '/notices', highlight: 'latest-notice', label: 'Go to Notices' },
      };
    }
    const summary = notices.slice(0, 3).map((n) => `\u2022 ${n.title} (${n.department}, ${formatDateShort(n.date)})`).join('\n');
    return {
      text: `Here are the latest notices:\n${summary}`,
      action: { path: '/notices', highlight: 'latest-notice', label: 'View Notices' },
    };
  }

  if (matchKeywords(lower, COMMON_QUESTIONS[2].keywords) || matchKeywords(lower, ['society event', 'society update', 'club', 'where.*announcement', 'find announcement'])) {
    const anns = await fetchLatestAnnouncements();
    if (anns.length === 0) {
      return {
        text: 'There are no society announcements on CampusSync right now. When societies post updates, they\u2019ll appear here.',
        action: { path: '/announcements', highlight: 'latest-announcement', label: 'Go to Announcements' },
      };
    }
    const summary = anns.slice(0, 3).map((a) => `\u2022 ${a.title} by ${a.society_name} (${formatDateShort(a.date)})`).join('\n');
    return {
      text: `Here are the latest society announcements:\n${summary}`,
      action: { path: '/announcements', highlight: 'latest-announcement', label: 'View Announcements' },
    };
  }

  if (matchKeywords(lower, COMMON_QUESTIONS[3].keywords) || matchKeywords(lower, ['upcoming', 'where.*event', 'find event', 'see event', 'register.*event', 'how do i register', 'event registration'])) {
    const events = await fetchUpcomingEvents();
    if (events.length === 0) {
      return {
        text: 'There are no upcoming events on CampusSync right now. Check back later!',
        action: { path: '/events', highlight: 'upcoming-events', label: 'Go to Events' },
      };
    }
    const summary = events.slice(0, 4).map((e) => `\u2022 ${e.title} on ${formatDateShort(e.date)} at ${e.location}`).join('\n');
    return {
      text: `Here are the upcoming events:\n${summary}\n\nYou can find more details and register on the Events page.`,
      action: { path: '/events', highlight: 'upcoming-events', label: 'View Events' },
    };
  }

  if (matchKeywords(lower, COMMON_QUESTIONS[4].keywords) || matchKeywords(lower, ['timetable clash', 'schedule conflict', 'class overlap', 'where.*clash', 'how.*clash', 'check clash'])) {
    return {
      text: 'You can see all your schedule clashes on the Timetable page. Clashes are highlighted in red so you can spot them quickly.',
      action: { path: '/timetable', highlight: 'clashes', label: 'Go to Timetable & Clashes' },
    };
  }

  if (matchKeywords(lower, COMMON_QUESTIONS[5].keywords) || matchKeywords(lower, ['where.*notification', 'find notification', 'see notification', 'my alert', 'where.*alert'])) {
    const notifs = await fetchNotifications();
    const unread = notifs.filter((n) => !n.read);
    if (notifs.length === 0) {
      return {
        text: 'You don\u2019t have any notifications right now. When you receive targeted notices, announcements, or event alerts, they\u2019ll show up in the notification bell at the top right.',
        action: { path: '/dashboard', highlight: 'notifications', label: 'Go to Dashboard' },
      };
    }
    return {
      text: `You have ${unread.length} unread notification${unread.length === 1 ? '' : 's'} out of ${notifs.length} recent. Click the bell icon in the top right to see them, or I can take you to the dashboard.`,
      action: { path: '/dashboard', highlight: 'notifications', label: 'Go to Dashboard' },
    };
  }

  if (matchKeywords(lower, ['timetable', 'schedule', 'class schedule', 'my class', 'where.*timetable', 'where.*class', 'what.*class today', 'class today'])) {
    const classes = await fetchClasses();
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayClasses = classes.filter((c) => c.day_of_week === todayName);
    if (todayClasses.length === 0) {
      return {
        text: `You don\u2019t have any classes scheduled for today (${todayName}). You can see your full weekly timetable on the Timetable page.`,
        action: { path: '/timetable', highlight: 'timetable', label: 'Go to Timetable' },
      };
    }
    const summary = todayClasses.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((c) => `\u2022 ${c.subject} at ${c.start_time} in ${c.room}`).join('\n');
    return {
      text: `Here are your classes for today (${todayName}):\n${summary}`,
      action: { path: '/timetable', highlight: 'timetable', label: 'View Full Timetable' },
    };
  }

  if (matchKeywords(lower, ['what changed', 'class change', 'what.*today', 'change.*class', 'update.*class'])) {
    const updates = await fetchCrUpdates(profile);
    if (updates.length === 0) {
      return {
        text: 'No class changes have been posted for your section today. Everything looks normal!',
        action: { path: '/dashboard', highlight: 'cr-updates', label: 'Check Class Updates' },
      };
    }
    const today = new Date().toISOString().split('T')[0];
    const todayUpdates = updates.filter((u) => u.date === today);
    if (todayUpdates.length === 0) {
      const summary = updates.slice(0, 2).map((u) => `\u2022 ${u.update_type} \u2014 ${u.subject} on ${formatDateShort(u.date)}`).join('\n');
      return {
        text: `No changes for today, but here are the most recent updates:\n${summary}`,
        action: { path: '/dashboard', highlight: 'cr-updates', label: 'View Class Updates' },
      };
    }
    const summary = todayUpdates.map((u) => `\u2022 ${u.update_type} \u2014 ${u.subject}: ${u.description}`).join('\n');
    return {
      text: `Here are today\u2019s class changes:\n${summary}`,
      action: { path: '/dashboard', highlight: 'cr-updates', label: 'View Class Updates' },
    };
  }

  if (matchKeywords(lower, ['register', 'sign up', 'create account', 'how.*register', 'how.*sign up'])) {
    return {
      text: 'You can register for CampusSync by clicking the Register button on the home page. Choose your role (Student, Society Admin, or College Admin) and fill in your details including branch, year, and section if you\u2019re a student.',
    };
  }

  if (matchKeywords(lower, ['about', 'what.*campussync', 'what.*this site', 'what.*this app', 'what.*this website'])) {
    return { text: WELCOME_TEXT, quickLinks: WELCOME_LINKS };
  }

  if (matchKeywords(lower, ['section', 'what.*section', 'what.*do', 'what does', 'how.*work', 'feature'])) {
    return {
      text: 'CampusSync has these main sections:\n\n\u2022 Dashboard \u2014 Overview of your classes, events, notices, announcements, and class updates\n\u2022 Timetable \u2014 Your weekly class schedule with clash detection\n\u2022 Events \u2014 Upcoming college events\n\u2022 Notices \u2014 Official college notices\n\u2022 Announcements \u2014 Society and club announcements\n\u2022 Notifications \u2014 Targeted alerts just for you\n\nAsk me about any of these or click a common question!',
    };
  }

  return {
    text: `I\u2019m not sure I understood that, but I\u2019m here to help with CampusSync! \u{1F63B}\n\nTry asking about:\n\u2022 Notices, Announcements, or Events\n\u2022 Class updates or Clashes\n\u2022 Your Timetable or Notifications\n\u2022 Or click "New Here?" for a quick tour.`,
    quickLinks: WELCOME_LINKS,
  };
}

export { COMMON_QUESTIONS, WELCOME_TEXT, WELCOME_LINKS };
