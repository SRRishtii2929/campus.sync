import { useEffect, useState } from 'react';
import { supabase, type Announcement, type ClassEntry, type EventEntry } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { detectClashes, formatDate } from '@/lib/clashDetection';
import ClashBadge from '@/components/ClashBadge';
import { Plus, Trash2, Loader2, Megaphone, Pencil, X, AlertCircle, CheckCircle2, Calendar, Clock, MapPin, AlertTriangle, Target, Clock4 } from 'lucide-react';

const BRANCHES = [
  'CSE', 'CSAI', 'CSE-CS', 'MAC', 'MAE', 'RAIE', 'ECE', 'ECE-AI',
  'DMAM', 'IT', 'AIML', 'BSc-MSc Physics', 'BSc-MSc Maths',
  'BSc-MSc Chemistry', 'BBA',
] as const;

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'] as const;

export default function Announcements() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<ClassEntry[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    title: '',
    content: '',
    society_name: '',
    date: new Date().toISOString().split('T')[0],
    event_date: '',
    event_time: '',
    registration_deadline: '',
    event_location: '',
    target_branches: [] as string[],
    target_years: [] as string[],
  });

  const isApprovedSocietyAdmin = profile?.role === 'society_admin' && profile?.approval_status === 'approved';
  const canCreate = isApprovedSocietyAdmin;
  const canDelete = isApprovedSocietyAdmin || profile?.role === 'college_admin';
  const isStudent = profile?.role === 'student';
  const isPendingSocietyAdmin = profile?.role === 'society_admin' && profile?.approval_status !== 'approved';

  const clashes = isStudent ? detectClashes(classes, events, undefined, announcements) : [];
  const announcementClashes = clashes.filter((clash) => clash.type === 'class_announcement' || clash.type === 'announcement_announcement' || clash.type === 'event_announcement');
  const clashedAnnouncementIds = new Set<string>();
  clashes.forEach((c) => {
    if (c.type === 'class_announcement' || c.type === 'announcement_announcement' || c.type === 'event_announcement') {
      announcements.forEach((ann) => {
        if (c.id.includes(ann.id)) clashedAnnouncementIds.add(ann.id);
      });
    }
  });

  async function loadData() {
    const [annRes, classesRes, eventsRes] = await Promise.all([
      supabase.from('announcements').select('*').order('date', { ascending: false }),
      supabase.from('classes').select('*').order('start_time'),
      supabase.from('events').select('*').order('date'),
    ]);
    setAnnouncements(annRes.data || []);
    setClasses(classesRes.data || []);
    setEvents(eventsRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setForm({ title: '', content: '', society_name: '', date: new Date().toISOString().split('T')[0], event_date: '', event_time: '', registration_deadline: '', event_location: '', target_branches: [], target_years: [] });
    setEditingId(null);
    setShowForm(false);
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    setSuccessMsg('');
    setTimeout(() => setErrorMsg(''), 4000);
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
      const { error } = await supabase.from('announcements').update({
        title: form.title, content: form.content, society_name: form.society_name, date: form.date,
        event_date: form.event_date || null,
        event_time: form.event_time || null,
        registration_deadline: form.registration_deadline || null,
        event_location: form.event_location || null,
        target_branches: targetBranches,
        target_years: targetYears,
      }).eq('id', editingId);
      if (error) { showError('Failed to update: ' + error.message); setSubmitting(false); return; }
      showSuccess('Announcement updated!');
    } else {
      const { data: insertData, error } = await supabase.from('announcements').insert({
        title: form.title, content: form.content, society_name: form.society_name, date: form.date,
        event_date: form.event_date || null,
        event_time: form.event_time || null,
        registration_deadline: form.registration_deadline || null,
        event_location: form.event_location || null,
        target_branches: targetBranches,
        target_years: targetYears,
      }).select('id');
      if (error) { showError('Failed to publish: ' + error.message); setSubmitting(false); return; }
      if (insertData && insertData[0]) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-targeted-students`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ announcement_id: insertData[0].id }),
        }).catch(() => {});
      }
      showSuccess('Announcement published!');
    }
    setSubmitting(false);
    resetForm();
    loadData();
  }

  function handleEdit(ann: Announcement) {
    setForm({
      title: ann.title,
      content: ann.content,
      society_name: ann.society_name,
      date: ann.date,
      event_date: ann.event_date || '',
      event_time: ann.event_time || '',
      registration_deadline: ann.registration_deadline || '',
      event_location: ann.event_location || '',
      target_branches: ann.target_branches || [],
      target_years: ann.target_years || [],
    });
    setEditingId(ann.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) { showError('Error: ' + error.message); return; }
    showSuccess('Announcement deleted.');
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Society Announcements</h1>
          <p className="text-slate-500 mt-1">Latest news from student societies and clubs</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> New Announcement
          </button>
        )}
      </div>

      {isPendingSocietyAdmin && (
        <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-200 flex items-center gap-3">
          <Clock4 className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">Pending Approval</p>
            <p className="text-xs text-orange-600 mt-0.5">Your Society Admin account is awaiting approval from a College Admin. You can view announcements but cannot publish until approved.</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {showForm && canCreate && (
        <div className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">{editingId ? 'Edit Announcement' : 'New Announcement'}</h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Annual Tech Fest Registration" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Society Name</label>
              <input type="text" value={form.society_name} onChange={(e) => setForm({ ...form, society_name: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Coding Society" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Event Date</label>
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Event Time</label>
              <input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Registration Deadline</label>
              <input type="date" value={form.registration_deadline} onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Event Location</label>
              <input type="text" value={form.event_location} onChange={(e) => setForm({ ...form, event_location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Auditorium, Block C" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required rows={4}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Announcement details..." />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-4 h-4 text-teal-600" />
                <label className="block text-sm font-medium text-slate-700">Target Branches (for notifications)</label>
              </div>
              <p className="text-xs text-slate-400 mb-2">Select branches to notify. Leave empty to notify all students. Announcement remains visible to everyone regardless.</p>
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
              <p className="text-xs text-slate-400 mb-2">Select years to notify. Leave empty to notify all students. Announcement remains visible to everyone regardless.</p>
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
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                {editingId ? 'Update' : 'Publish'}
              </button>
              <button type="button" onClick={resetForm}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isStudent && announcementClashes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-bold text-slate-800">Schedule Clashes ({announcementClashes.length})</h2>
          </div>
          <div className="space-y-3">
            {announcementClashes.map((clash) => (
              <ClashBadge key={clash.id} clash={clash} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="text-center py-16">
            <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400">No announcements yet.</p>
          </div>
        ) : (
          announcements.map((ann) => {
            const hasClash = clashedAnnouncementIds.has(ann.id);
            return (
            <div key={ann.id} className={`group bg-white rounded-2xl border-2 p-5 shadow-sm transition-all ${
              hasClash ? 'border-red-300' : 'border-slate-200 hover:shadow-md'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="text-lg font-semibold text-slate-800">{ann.title}</h3>
                    {hasClash && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                        <AlertTriangle className="w-3 h-3" /> Clash Detected
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      <Megaphone className="w-3 h-3" /> {ann.society_name}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{ann.content}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {formatDate(ann.date)}
                    </span>
                    {ann.event_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Event: {formatDate(ann.event_date)}
                      </span>
                    )}
                    {ann.event_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {ann.event_time}
                      </span>
                    )}
                    {ann.event_location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {ann.event_location}
                      </span>
                    )}
                    {ann.registration_deadline && (
                      <span className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" /> Register by: {formatDate(ann.registration_deadline)}
                      </span>
                    )}
                  </div>
                </div>
                {canDelete && (ann.created_by === profile?.id || profile?.role === 'college_admin') && (
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {ann.created_by === profile?.id && (
                      <button onClick={() => handleEdit(ann)} className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(ann.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
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
