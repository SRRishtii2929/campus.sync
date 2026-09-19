import { useEffect, useState } from 'react';
import { supabase, type ClassEntry, type EventEntry, type Announcement } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { detectClashes, formatTime12 } from '@/lib/clashDetection';
import ClashBadge from '@/components/ClashBadge';
import { useHighlight } from '@/lib/useHighlight';
import { Plus, Trash2, Loader2, AlertTriangle, Clock, MapPin, Calendar } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export default function Timetable() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassEntry[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
    room: '',
  });

  async function loadData() {
    const [classesRes, eventsRes, announcementsRes] = await Promise.all([
      supabase.from('classes').select('*').order('start_time'),
      supabase.from('events').select('*').order('date'),
      supabase.from('announcements').select('*').order('date', { ascending: false }),
    ]);
    setClasses(classesRes.data || []);
    setEvents(eventsRes.data || []);
    setAnnouncements(announcementsRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const clashes = detectClashes(classes, events, undefined, announcements);
  useHighlight();
  const classClashes = clashes.filter((clash) => clash.type === 'class_class' || clash.type === 'class_event' || clash.type === 'class_announcement');
  const clashedClassIds = new Set<string>();
  clashes.forEach((c) => {
    if (c.type === 'class_class' || c.type === 'class_event' || c.type === 'class_announcement') {
      const ids = c.id.split('-').slice(1);
      ids.forEach((id) => {
        const cls = classes.find((cl) => cl.id === id);
        if (cls) clashedClassIds.add(cls.id);
      });
    }
  });

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from('classes').insert({
      user_id: user?.id,
      subject: form.subject,
      day_of_week: form.day_of_week,
      date: null,
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room || 'TBD',
    });
    setSubmitting(false);
    if (error) {
      alert('Error adding class: ' + error.message);
      return;
    }
    setForm({ subject: '', day_of_week: 'Monday', start_time: '09:00', end_time: '10:00', room: '' });
    setShowForm(false);
    loadData();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) {
      alert('Error deleting class: ' + error.message);
      return;
    }
    loadData();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">My Timetable</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your weekly class schedule</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" /> Add Class
        </button>
      </div>

      {classClashes.length > 0 && (
        <div className="mb-8" id="clashes">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Schedule Clashes ({classClashes.length})</h2>
          </div>
          <div className="space-y-3">
            {classClashes.map((clash) => (
              <ClashBadge key={clash.id} clash={clash} />
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Add New Class</h3>
          <form onSubmit={handleAddClass} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Mathematics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Day of Week</label>
              <select
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
              >
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room</label>
              <input
                type="text"
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Room 101"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Class
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {DAYS.filter((d) => classes.some((c) => c.day_of_week === d)).map((day) => (
          <div key={day} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">{day}</h3>
            <div className="space-y-2">
              {classes
                .filter((c) => c.day_of_week === day)
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((cls) => {
                  const hasClash = clashedClassIds.has(cls.id);
                  return (
                    <div
                      key={cls.id}
                      className={`group p-3 rounded-xl border transition-all ${
                        hasClash
                          ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{cls.subject}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formatTime12(cls.start_time)} – {formatTime12(cls.end_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {cls.room}
                            </span>
                            {cls.date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {cls.date}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {hasClash && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          <button
                            onClick={() => handleDelete(cls.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
        {classes.length === 0 && (
          <div className="col-span-full text-center py-16">
            <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 dark:text-slate-500">No classes yet. Click "Add Class" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
