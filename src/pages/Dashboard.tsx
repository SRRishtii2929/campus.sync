import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase, type ClassEntry, type EventEntry, type Notice, type Announcement, type CrUpdate } from '@/lib/supabase';
import { detectClashes, formatDate, formatTime12 } from '@/lib/clashDetection';
import ClashBadge from '@/components/ClashBadge';
import TargetAudienceBadge from '@/components/TargetAudienceBadge';
import InterestTags from '@/components/InterestTags';
import { useHighlight } from '@/lib/useHighlight';
import { Calendar, Bell, Megaphone, Users, AlertTriangle, ArrowRight, Clock, MapPin, Plus, Loader2, X, CheckCircle2, AlertCircle, GraduationCap, FileText } from 'lucide-react';

const UPDATE_TYPES = [
  'Class Cancelled', 'Extra Class', 'Class Rescheduled',
  'Room Changed', 'Timing Changed', 'Other',
] as const;

export default function Dashboard() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassEntry[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [crUpdates, setCrUpdates] = useState<CrUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCrForm, setShowCrForm] = useState(false);
  const [submittingCr, setSubmittingCr] = useState(false);
  const [crForm, setCrForm] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '',
    subject: '',
    location: '',
    update_type: 'Class Cancelled' as string,
    description: '',
  });
  const [crSuccess, setCrSuccess] = useState('');
  const [crError, setCrError] = useState('');

  const isApprovedCR = profile?.role === 'student' && profile?.student_type === 'cr' && profile?.approval_status === 'approved';
  const isPendingCR = profile?.role === 'student' && profile?.student_type === 'cr' && profile?.approval_status !== 'approved';
  const isStudent = profile?.role === 'student';
  useHighlight();

  useEffect(() => {
    async function loadData() {
      const [classesRes, eventsRes, noticesRes, announcementsRes, crRes] = await Promise.all([
        supabase.from('classes').select('*').order('start_time'),
        supabase.from('events').select('*').order('date'),
        supabase.from('notices').select('*').order('date', { ascending: false }).limit(5),
        supabase.from('announcements').select('*').order('date', { ascending: false }).limit(5),
        supabase.from('cr_updates').select('*').order('date', { ascending: true }),
      ]);

      setClasses(classesRes.data || []);
      setEvents(eventsRes.data || []);
      setNotices(noticesRes.data || []);
      setAnnouncements(announcementsRes.data || []);
      setCrUpdates(crRes.data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  const allClashes = detectClashes(classes, events, undefined, announcements);
  const clashes = isStudent ? allClashes : [];
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayClasses = classes.filter((c) => c.day_of_week === todayName || c.date === new Date().toISOString().split('T')[0]);
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingEvents = events.filter((e) => new Date(e.date) >= new Date(new Date().toDateString())).slice(0, 4);

  const now = new Date();
  const activeCrUpdates = crUpdates.filter((u) => {
    const updateDate = new Date(u.date + 'T00:00:00');
    const endOfDay = new Date(updateDate);
    endOfDay.setHours(23, 59, 59, 999);
    if (u.end_time) {
      const [eh, em] = u.end_time.split(':').map(Number);
      const endTime = new Date(updateDate);
      endTime.setHours(eh, em, 0, 0);
      return endTime >= now;
    }
    return endOfDay >= now;
  });

  const myCrUpdates = isStudent && profile?.branch && profile?.year && profile?.section
    ? activeCrUpdates.filter((u) => u.branch === profile.branch && u.year === profile.year && u.section === profile.section)
    : [];

  async function handleCrSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!crForm.subject.trim() || !crForm.description.trim() || !crForm.date) {
      setCrError('Please fill in all required fields.');
      return;
    }
    setSubmittingCr(true);
    const { data: insertData, error } = await supabase.from('cr_updates').insert({
      cr_id: profile?.id,
      branch: profile?.branch,
      year: profile?.year,
      section: profile?.section,
      date: crForm.date,
      start_time: crForm.start_time,
      end_time: crForm.end_time || null,
      subject: crForm.subject,
      location: crForm.location || null,
      update_type: crForm.update_type,
      description: crForm.description,
    }).select('id');
    if (error) {
      setCrError('Failed to post update: ' + error.message);
      setSubmittingCr(false);
      return;
    }
    if (insertData && insertData[0]) {
      const { data: sessionData } = await supabase.auth.getSession();
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-cr-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({ cr_update_id: insertData[0].id }),
      }).catch(() => {});
    }
    setCrSuccess('Class update posted successfully!');
    setCrError('');
    setTimeout(() => setCrSuccess(''), 4000);
    setCrForm({ date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '', subject: '', location: '', update_type: 'Class Cancelled', description: '' });
    setSubmittingCr(false);
    setShowCrForm(false);
    const { data: crRes } = await supabase.from('cr_updates').select('*').order('date', { ascending: true });
    setCrUpdates(crRes || []);
  }

  async function handleDeleteCrUpdate(id: string) {
    if (!confirm('Delete this class update?')) return;
    const { error } = await supabase.from('cr_updates').delete().eq('id', id);
    if (error) { setCrError('Error: ' + error.message); return; }
    const { data: crRes } = await supabase.from('cr_updates').select('*').order('date', { ascending: true });
    setCrUpdates(crRes || []);
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8" id="notifications">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
          Welcome back, {profile?.full_name}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          You're signed in as <span className="capitalize font-medium text-teal-600 dark:text-teal-400">{profile?.role?.replace('_', ' ')}</span>
          {profile?.branch && ` · ${profile.branch}`}
          {profile?.year && ` · ${profile.year}`}
          {profile?.section && ` · Section ${profile.section}`}
          {isApprovedCR && ' · CR (Approved)'}
          {isPendingCR && ' · CR (Pending Approval)'}
        </p>
      </div>

      {isPendingCR && (
        <div className="mb-6 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 flex items-center gap-3">
          <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Pending CR Approval</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">Your CR (Class Representative) account is awaiting approval from a College Admin. Posting privileges will be enabled once approved.</p>
          </div>
        </div>
      )}

      {crSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">{crSuccess}</p>
        </div>
      )}
      {crError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{crError}</p>
        </div>
      )}

      {isApprovedCR && (
        <div className="mb-6">
          {!showCrForm ? (
            <button
              onClick={() => setShowCrForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" /> Post Class Update
            </button>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Post Class Update</h3>
                <button onClick={() => setShowCrForm(false)} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400">
                Posting for: <span className="font-medium">{profile?.branch} · {profile?.year} · Section {profile?.section}</span> (from your profile)
              </div>
              <form onSubmit={handleCrSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                  <input type="date" value={crForm.date} onChange={(e) => setCrForm({ ...crForm, date: e.target.value })} required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time *</label>
                  <input type="time" value={crForm.start_time} onChange={(e) => setCrForm({ ...crForm, start_time: e.target.value })} required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time (if applicable)</label>
                  <input type="time" value={crForm.end_time} onChange={(e) => setCrForm({ ...crForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject/Class *</label>
                  <input type="text" value={crForm.subject} onChange={(e) => setCrForm({ ...crForm, subject: e.target.value })} required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                    placeholder="Data Structures" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location/Room</label>
                  <input type="text" value={crForm.location} onChange={(e) => setCrForm({ ...crForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                    placeholder="Room 101, Block A" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Update Type *</label>
                  <select value={crForm.update_type} onChange={(e) => setCrForm({ ...crForm, update_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none">
                    {UPDATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Details *</label>
                  <textarea value={crForm.description} onChange={(e) => setCrForm({ ...crForm, description: e.target.value })} required rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                    placeholder="Class is cancelled due to..." />
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
                  <button type="submit" disabled={submittingCr}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors disabled:opacity-50">
                    {submittingCr ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Post Update
                  </button>
                  <button type="button" onClick={() => setShowCrForm(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:bg-slate-700 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {clashes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Schedule Clashes ({clashes.length})</h2>
          </div>
          <div className="space-y-3">
            {clashes.slice(0, 5).map((clash) => (
              <ClashBadge key={clash.id} clash={clash} />
            ))}
            {clashes.length > 5 && (
              <Link to="/timetable" className="text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline flex items-center gap-1">
                View all clashes <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      {isStudent && myCrUpdates.length > 0 && (
        <div className="mb-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm" id="cr-updates">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Class Updates ({myCrUpdates.length})</h2>
          </div>
          <div className="space-y-2">
            {myCrUpdates.map((u) => (
              <div key={u.id} className="group p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-teal-50/30 dark:bg-teal-900/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                        {u.update_type}
                      </span>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{u.subject}</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{u.description}</p>
                    <div className="mt-2">
                      <TargetAudienceBadge branch={u.branch} year={u.year} section={u.section} />
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(u.date)}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime12(u.start_time)}{u.end_time ? ` – ${formatTime12(u.end_time)}` : ''}</span>
                      {u.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {u.location}</span>}
                    </div>
                  </div>
                  {isApprovedCR && u.cr_id === profile?.id && (
                    <button
                      onClick={() => handleDeleteCrUpdate(u.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-red-500 hover:bg-red-50 dark:bg-red-950/40 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isStudent && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Today's Classes</h2>
            </div>
            <Link to="/timetable" className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {todayClasses.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">No classes scheduled for today.</p>
          ) : (
            <div className="space-y-2">
              {todayClasses.map((cls) => {
                const clashExists = clashes.some(c => c.activityA.label === cls.subject || c.activityB.label === cls.subject);
                return (
                  <div key={cls.id} className={`flex items-center gap-3 p-3 rounded-xl border ${clashExists ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'}`}>
                    <div className="flex flex-col items-center min-w-[60px]">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatTime12(cls.start_time)}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatTime12(cls.end_time)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{cls.subject}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {cls.room}
                      </p>
                    </div>
                    {clashExists && <AlertTriangle className="w-5 h-5 text-red-500" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm" id="upcoming-events">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Upcoming Events</h2>
            </div>
            <Link to="/events" className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">No upcoming events.</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((evt) => {
                const clashExists = clashes.some(c => c.activityA.label === evt.title || c.activityB.label === evt.title);
                return (
                  <div key={evt.id} className={`flex items-center gap-3 p-3 rounded-xl border ${clashExists ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'}`}>
                    <div className="flex flex-col items-center min-w-[60px]">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatTime12(evt.start_time)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{evt.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {evt.location}
                      </p>
                      <div className="mt-1.5">
                        <TargetAudienceBadge branches={evt.target_branches} years={evt.target_years} variant="compact" />
                        <InterestTags interests={evt.target_interests} variant="compact" />
                      </div>
                    </div>
                    {clashExists && <AlertTriangle className="w-5 h-5 text-red-500" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm" id="latest-notice">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Recent Notices</h2>
            </div>
            <Link to="/notices" className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {notices.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">No notices yet.</p>
          ) : (
            <div className="space-y-2">
              {notices.map((notice) => (
                <div key={notice.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-900/20">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{notice.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatDate(notice.date)}</p>
                  <div className="mt-1.5">
                    <TargetAudienceBadge branches={notice.target_branches} years={notice.target_years} variant="compact" />
                    <InterestTags interests={notice.target_interests} variant="compact" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm" id="latest-announcement">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Recent Announcements</h2>
            </div>
            <Link to="/announcements" className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">No announcements yet.</p>
          ) : (
            <div className="space-y-2">
              {announcements.map((ann) => {
                const clashExists = isStudent && clashes.some(c => (c.type === 'class_announcement' || c.type === 'announcement_announcement' || c.type === 'event_announcement') && (c.id.includes(ann.id)));
                return (
                  <div key={ann.id} className={`p-3 rounded-xl border ${clashExists ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40' : 'border-slate-200 dark:border-slate-700 bg-purple-50/50 dark:bg-purple-900/20'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{ann.title}</p>
                      {clashExists && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ann.society_name} · {formatDate(ann.date)}</p>
                    <div className="mt-1.5">
                      <TargetAudienceBadge branches={ann.target_branches} years={ann.target_years} variant="compact" />
                      <InterestTags interests={ann.target_interests} variant="compact" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
