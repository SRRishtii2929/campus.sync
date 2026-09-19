import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'X-Client-Info': 'campus-sync',
    },
  },
});

export type UserRole = 'student' | 'society_admin' | 'college_admin' | 'primary_admin';
export type StudentType = 'regular' | 'cr';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: string;
  branch: string | null;
  year: string | null;
  section: string | null;
  student_type: StudentType | null;
  approval_status: ApprovalStatus | null;
  society_name: string | null;
  interests: string[] | null;
  created_at: string;
}

export interface ClassEntry {
  id: string;
  user_id: string;
  subject: string;
  day_of_week: string;
  date: string | null;
  start_time: string;
  end_time: string;
  room: string;
  created_at: string;
}

export interface EventEntry {
  id: string;
  title: string;
  description: string;
  date: string;
  event_date: string | null;
  start_time: string;
  end_time: string;
  location: string;
  organizer: string;
  registration_url: string | null;
  target_branches: string[] | null;
  target_years: string[] | null;
  target_interests: string[] | null;
  image_path: string | null;
  created_by: string | null;
  created_at: string;
}

export function getEventDate(evt: EventEntry): string {
  return evt.event_date || evt.date;
}

export interface Notice {
  id: string;
  title: string;
  description: string;
  date: string;
  deadline: string | null;
  attachment_url: string | null;
  image_path: string | null;
  target_branches: string[] | null;
  target_years: string[] | null;
  target_interests: string[] | null;
  created_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  notice_id: string | null;
  announcement_id: string | null;
  cr_update_id: string | null;
  event_id: string | null;
  title: string;
  description: string;
  read: boolean;
  created_at: string;
}

export interface ChatbotHistoryEntry {
  id: string;
  user_id: string;
  role: 'user' | 'buddy';
  text: string;
  action_path: string | null;
  action_highlight: string | null;
  action_label: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  society_name: string;
  date: string;
  event_date: string | null;
  event_time: string | null;
  registration_deadline: string | null;
  event_location: string | null;
  registration_url: string | null;
  target_branches: string[] | null;
  target_years: string[] | null;
  target_interests: string[] | null;
  image_path: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Society {
  id: string;
  name: string;
  description: string;
  president_id: string | null;
  created_at: string;
}

export interface CrUpdate {
  id: string;
  cr_id: string;
  branch: string;
  year: string;
  section: string;
  date: string;
  start_time: string;
  end_time: string | null;
  subject: string;
  location: string | null;
  update_type: string;
  description: string;
  created_at: string;
}
