import { useEffect, useState } from 'react';
import { supabase, type EventEntry, type ClassEntry, type Announcement } from '@/lib/supabase';
import { useHighlight } from '@/lib/useHighlight';
import { useAuth } from '@/context/AuthContext';
import { detectClashes, formatDate, formatTime12 } from '@/lib/clashDetection';
import ClashBadge from '@/components/ClashBadge';
import TargetAudienceBadge from '@/components/TargetAudienceBadge';
import { Plus, Trash2, Loader2, AlertTriangle, Clock, MapPin, Calendar, Users, Pencil, X, Target } from 'lucide-react';

const BRANCHES = [
  'CSE', 'CSAI', 'CSE-CS', 'MAC', 'MAE', 'RAIE', 'ECE', 'ECE-AI',
  'DMAM', 'IT', 'AIML', 'BSc-MSc Physics', 'BSc-MSc Maths',
  'BSc-MSc Chemistry', 'BBA',
] as const;

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'] as const;

export default function Events() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [classes, setClasses] = useState<ClassEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '10:00',
    end_time: '12:00',
    location: '',
    organizer: 'College Administration',
    target_branches: [] as string[],
    target_years: [] as string[],
  });

  const isCollegeAdmin = profile?.role === 'college_admin';
  useHighlight();

  async function loadData() {
    const [eventsRes, classesRes, announcementsRes] = await Promise.all([
      supabase.from('events').select('*').order('date'),
      supabase.from('classes').select('*').order('start_time'),
      supabase.from('announcements').select('*').order('date', { ascending: false }),
    ]);
    setEvents(eventsRes.data || []);
    setClasses(classesRes.data || []);
    setAnnouncements(announcementsRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const clashes = profile?.role === 'student' ? detectClashes(classes, events, undefined, announcements) : [];
  const eventClashes = clashes.filter((clash) => clash.type === 'class_event' || clash.type === 'event_event' || clash.type === 'event_announcement');
  const eventClashIds = new Set<string>();
  clashes.forEach((c) => {
    if (c.type === 'class_event' || c.type === 'event_event' || c.type === 'event_announcement') {
      const ids = c.id.split('-').slice(1);
      ids.forEach((id) => {
        if (events.some((e) => e.id === id)) eventClashIds.add(id);
      });
    }
  });

  function resetForm() {
    setForm({ title: '', description: '', date: '', start_time: '10:00', end_time: '12:00', location: '', organizer: 'College Administration', target_branches: [], target_years: [] });
    setEditingId(null);
    setShowForm(false);
  }

  function toggleBranch(branch: string) {
    setForm((prev) => ({
      ...prev,
      target_branches: prev.target_branches.includes(branch)
        ? prev.target_branches.filter((b) => b !== branch)
        : [...prev.target_branches, branch],
    }));
  }

  function toggleYear(year: string) {
    setForm((prev) => ({
      ...prev,
      target_years: prev.target_years.includes(year)
        ? prev.target_years.filter((y) => y !== year)
        : [...prev.target_years, year],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const targetBranches = form.target_branches.length > 0 ? form.target_branches : null;
    const targetYears = form.target_years.length > 0 ? form.target_years : null;
    if (editingId) {
      const { error } = await supabase.from('events').update({
        title: form.title,
        description: form.description,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location || 'TBD',
        organizer: form.organizer,
        target_branches: targetBranches,
        target_years: targetYears,
      }).eq('id', editingId);
      if (error) alert('Error updating event: ' + error.message);
    } else {
      const { data: insertData, error } = await supabase.from('events').insert({
        title: form.title,
        description: form.description,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location || 'TBD',
        organizer: form.organizer,
        target_branches: targetBranches,
        target_years: targetYears,
      }).select('id');
      if (error) { alert('Error creating event: ' + error.message); setSubmitting(false); return; }
      if (insertData && insertData[0]) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-targeted-students`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ event_id: insertData[0].id }),
        }).catch(() => {});
      }
    }
    setSubmitting(false);
    resetForm();
    loadData();
  }

  function handleEdit(evt: EventEntry) {
    setForm({
      title: evt.title,
      description: evt.description,
      date: evt.date,
      start_time: evt.start_time,
      end_time: evt.end_time,
      location: evt.location,
      organizer: evt.organizer,
      target_branches: evt.target_branches || [],
      target_years: evt.target_years || [],
    });
    setEditingId(evt.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">College Events</h1>
          <p className="text-slate-500 mt-1">Browse and manage upcoming college events</p>
        </div>
        {isCollegeAdmin && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Add Event
          </button>
        )}
      </div>

      {eventClashes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-bold text-slate-800">Event Clashes ({eventClashes.length})</h2>
          </div>
          <div className="space-y-3">
            {eventClashes.map((clash) => (
              <ClashBadge key={clash.id} clash={clash} />
            ))}
          </div>
        </div>
      )}

      {showForm && isCollegeAdmin && (
        <div className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">{editingId ? 'Edit Event' : 'Add New Event'}</h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" placeholder="College Seminar" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" rows={2} placeholder="Event description..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" placeholder="Auditorium" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Organizer</label>
              <input type="text" value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-4 h-4 text-teal-600" />
                <label className="block text-sm font-medium text-slate-700">Target Branches (for notifications)</label>
              </div>
              <p className="text-xs text-slate-400 mb-2">Select branches to notify. Leave empty to notify all students. Event remains visible to everyone regardless.</p>
              <div className="flex flex-wrap gap-2">
                {BRANCHES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBranch(b)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.target_branches.includes(b)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-4 h-4 text-teal-600" />
                <label className="block text-sm font-medium text-slate-700">Target Years (for notifications)</label>
              </div>
              <p className="text-xs text-slate-400 mb-2">Select years to notify. Leave empty to notify all students. Event remains visible to everyone regardless.</p>
              <div className="flex flex-wrap gap-2">
                {YEARS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => toggleYear(y)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.target_years.includes(y)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editingId ? 'Update Event' : 'Create Event'}
              </button>
              <button type="button" onClick={resetForm}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400">No events scheduled yet.</p>
          </div>
        ) : (
          events.map((evt, idx) => {
            const hasClash = eventClashIds.has(evt.id);
            return (
              <div key={evt.id} id={idx === 0 ? 'upcoming-events' : undefined} className={`group bg-white rounded-2xl border-2 p-5 shadow-sm transition-all ${
                hasClash ? 'border-red-300' : 'border-slate-200 hover:border-teal-300 hover:shadow-md'
              }`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-800">{evt.title}</h3>
                    {hasClash && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                        <AlertTriangle className="w-3 h-3" /> Clash Detected
                      </span>
                    )}
                  </div>
                  {isCollegeAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(evt)} className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(evt.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {evt.description && <p className="text-sm text-slate-500 mb-3">{evt.description}</p>}
                <div className="mb-3">
                  <TargetAudienceBadge branches={evt.target_branches} years={evt.target_years} />
                </div>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(evt.date)}</p>
                  <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatTime12(evt.start_time)} – {formatTime12(evt.end_time)}</p>
                  <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {evt.location}</p>
                  <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {evt.organizer}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
