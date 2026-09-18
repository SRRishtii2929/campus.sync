import { useEffect, useState } from 'react';
import { supabase, type EventEntry, type ClassEntry, type Announcement } from '@/lib/supabase';
import { useHighlight } from '@/lib/useHighlight';
import { useAuth } from '@/context/AuthContext';
import { detectClashes, formatDate, formatTime12 } from '@/lib/clashDetection';
import ClashBadge from '@/components/ClashBadge';
import TargetAudienceBadge from '@/components/TargetAudienceBadge';
import { Plus, Trash2, Loader2, AlertTriangle, Clock, MapPin, Calendar, Users, Pencil, X, Target, ExternalLink } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import ImagePreview from '@/components/ImagePreview';
import InterestSelector from '@/components/InterestSelector';
import { uploadImage, deleteImage } from '@/lib/imageUpload';

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
    registration_url: '',
    target_branches: [] as string[],
    target_years: [] as string[],
    target_interests: [] as string[],
  });
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [removedImage, setRemovedImage] = useState(false);
  const [editingImagePath, setEditingImagePath] = useState<string | null>(null);

  const isCollegeAdmin = profile?.role === 'college_admin' || profile?.role === 'primary_admin';
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
    setForm({ title: '', description: '', date: '', start_time: '10:00', end_time: '12:00', location: '', organizer: 'College Administration', registration_url: '', target_branches: [], target_years: [], target_interests: [] });
    setEditingId(null);
    setShowForm(false);
    setPendingImage(null);
    setRemovedImage(false);
    setEditingImagePath(null);
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
    const targetInterests = form.target_interests.length > 0 ? form.target_interests : null;

    let imagePath: string | null = editingImagePath;
    if (pendingImage) {
      const uploaded = await uploadImage(pendingImage, 'events');
      if (uploaded) {
        if (editingImagePath) await deleteImage(editingImagePath);
        imagePath = uploaded;
      }
    } else if (removedImage) {
      if (editingImagePath) await deleteImage(editingImagePath);
      imagePath = null;
    }

    if (editingId) {
      const { error } = await supabase.from('events').update({
        title: form.title,
        description: form.description,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location || 'TBD',
        organizer: form.organizer,
        registration_url: form.registration_url || null,
        image_path: imagePath,
        target_branches: targetBranches,
        target_years: targetYears,
        target_interests: targetInterests,
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
        registration_url: form.registration_url || null,
        image_path: imagePath,
        target_branches: targetBranches,
        target_years: targetYears,
        target_interests: targetInterests,
      }).select('id');
      if (error) { alert('Error creating event: ' + error.message); setSubmitting(false); return; }
      if (insertData && insertData[0]) {
        const { data: sessionData } = await supabase.auth.getSession();
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-targeted-students`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.session?.access_token}`,
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
      registration_url: evt.registration_url || '',
      target_branches: evt.target_branches || [],
      target_years: evt.target_years || [],
      target_interests: evt.target_interests || [],
    });
    setEditingId(evt.id);
    setEditingImagePath(evt.image_path);
    setPendingImage(null);
    setRemovedImage(false);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return;
    const evt = events.find((e) => e.id === id);
    if (evt?.image_path) await deleteImage(evt.image_path);
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
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">College Events</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Browse and manage upcoming college events</p>
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
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Event Clashes ({eventClashes.length})</h2>
          </div>
          <div className="space-y-3">
            {eventClashes.map((clash) => (
              <ClashBadge key={clash.id} clash={clash} />
            ))}
          </div>
        </div>
      )}

      {showForm && isCollegeAdmin && (
        <div className="mb-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{editingId ? 'Edit Event' : 'Add New Event'}</h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:bg-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" placeholder="College Seminar" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" rows={2} placeholder="Event description..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" placeholder="Auditorium" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Organizer</label>
              <input type="text" value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Registration URL (optional)</label>
              <input type="url" value={form.registration_url} onChange={(e) => setForm({ ...form, registration_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="https://forms.google.com/..." />
            </div>
            <div className="sm:col-span-2">
              <ImageUpload
                folder="events"
                existingPath={editingImagePath}
                onImageChange={(file, removed) => {
                  setPendingImage(file);
                  setRemovedImage(removed);
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Target Branches (for notifications)</label>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Select branches to notify. Leave empty to notify all students. Event remains visible to everyone regardless.</p>
              <div className="flex flex-wrap gap-2">
                {BRANCHES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBranch(b)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.target_branches.includes(b)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-teal-400'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Target Years (for notifications)</label>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Select years to notify. Leave empty to notify all students. Event remains visible to everyone regardless.</p>
              <div className="flex flex-wrap gap-2">
                {YEARS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => toggleYear(y)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.target_years.includes(y)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-teal-400'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <InterestSelector
                selected={form.target_interests}
                onChange={(interests) => setForm({ ...form, target_interests: interests })}
                label="Target Interests"
                hint="Select interests to notify only students who match. Leave empty to notify all eligible students."
                optional
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editingId ? 'Update Event' : 'Create Event'}
              </button>
              <button type="button" onClick={resetForm}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:bg-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 dark:text-slate-500">No events scheduled yet.</p>
          </div>
        ) : (
          events.map((evt, idx) => {
            const hasClash = eventClashIds.has(evt.id);
            return (
              <div key={evt.id} id={idx === 0 ? 'upcoming-events' : undefined} className={`group bg-white dark:bg-slate-800 rounded-2xl border-2 p-5 shadow-sm transition-all ${
                hasClash ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700 hover:border-teal-300 hover:shadow-md'
              }`}>
                <div className={`flex gap-5 ${evt.image_path ? 'flex-col sm:flex-row' : ''}`}>
                  {/* Details (left on desktop, top on mobile) */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{evt.title}</h3>
                        {hasClash && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                            <AlertTriangle className="w-3 h-3" /> Clash Detected
                          </span>
                        )}
                      </div>
                      {isCollegeAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => handleEdit(evt)} className="p-1.5 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:bg-teal-900/30">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(evt.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:bg-red-950/40">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {evt.description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{evt.description}</p>}
                    <div className="mb-3">
                      <TargetAudienceBadge branches={evt.target_branches} years={evt.target_years} />
                      {evt.target_interests && evt.target_interests.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Interests:</span>
                          {evt.target_interests.map((interest) => (
                            <span key={interest} className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">{interest}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(evt.date)}</p>
                      <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatTime12(evt.start_time)} – {formatTime12(evt.end_time)}</p>
                      <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {evt.location}</p>
                      <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {evt.organizer}</p>
                      {evt.registration_url && (
                        <a href={evt.registration_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline">
                          <ExternalLink className="w-3.5 h-3.5" /> Register / More Info
                        </a>
                      )}
                    </div>
                  </div>
                  {/* Image (right on desktop, below on mobile) */}
                  {evt.image_path && (
                    <div className="sm:w-56 sm:flex-shrink-0">
                      <ImagePreview path={evt.image_path} alt={evt.title} maxHeight="max-h-56" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
