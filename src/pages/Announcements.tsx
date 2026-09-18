import { useEffect, useState } from 'react';
import { supabase, type Announcement, type ClassEntry, type EventEntry } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { detectClashes, formatDate } from '@/lib/clashDetection';
import ClashBadge from '@/components/ClashBadge';
import TargetAudienceBadge from '@/components/TargetAudienceBadge';
import { useHighlight } from '@/lib/useHighlight';
import { Plus, Trash2, Loader2, Megaphone, Pencil, X, AlertCircle, CheckCircle2, Calendar, Clock, MapPin, AlertTriangle, Target, Clock4, ExternalLink } from 'lucide-react';
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
    registration_url: '',
    target_branches: [] as string[],
    target_years: [] as string[],
    target_interests: [] as string[],
  });
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [removedImage, setRemovedImage] = useState(false);
  const [editingImagePath, setEditingImagePath] = useState<string | null>(null);

  const isApprovedSocietyAdmin = profile?.role === 'society_admin' && profile?.approval_status === 'approved';
  const canCreate = isApprovedSocietyAdmin;
  const canDelete = isApprovedSocietyAdmin || profile?.role === 'college_admin';
  const isStudent = profile?.role === 'student';
  const isPendingSocietyAdmin = profile?.role === 'society_admin' && profile?.approval_status !== 'approved';
  useHighlight();

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
    setForm({
      title: '',
      content: '',
      society_name: profile?.role === 'society_admin' ? (profile.society_name || profile.full_name) : '',
      date: new Date().toISOString().split('T')[0],
      event_date: '',
      event_time: '',
      registration_deadline: '',
      event_location: '',
      registration_url: '',
      target_branches: [],
      target_years: [],
      target_interests: [],
    });
    setEditingId(null);
    setShowForm(false);
    setPendingImage(null);
    setRemovedImage(false);
    setEditingImagePath(null);
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
    const targetInterests = form.target_interests.length > 0 ? form.target_interests : null;

    let imagePath: string | null = editingImagePath;
    if (pendingImage) {
      const uploaded = await uploadImage(pendingImage, 'announcements');
      if (uploaded) {
        if (editingImagePath) await deleteImage(editingImagePath);
        imagePath = uploaded;
      }
    } else if (removedImage) {
      if (editingImagePath) await deleteImage(editingImagePath);
      imagePath = null;
    }

    if (editingId) {
      const { error } = await supabase.from('announcements').update({
        title: form.title, content: form.content, society_name: form.society_name, date: form.date,
        event_date: form.event_date || null,
        event_time: form.event_time || null,
        registration_deadline: form.registration_deadline || null,
        event_location: form.event_location || null,
        registration_url: form.registration_url || null,
        image_path: imagePath,
        target_branches: targetBranches,
        target_years: targetYears,
        target_interests: targetInterests,
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
        registration_url: form.registration_url || null,
        image_path: imagePath,
        target_branches: targetBranches,
        target_years: targetYears,
        target_interests: targetInterests,
      }).select('id');
      if (error) { showError('Failed to publish: ' + error.message); setSubmitting(false); return; }
      if (insertData && insertData[0]) {
        const { data: sessionData } = await supabase.auth.getSession();
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-targeted-students`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.session?.access_token}`,
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
      registration_url: ann.registration_url || '',
      target_branches: ann.target_branches || [],
      target_years: ann.target_years || [],
      target_interests: ann.target_interests || [],
    });
    setEditingId(ann.id);
    setEditingImagePath(ann.image_path);
    setPendingImage(null);
    setRemovedImage(false);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement?')) return;
    const ann = announcements.find((a) => a.id === id);
    if (ann?.image_path) await deleteImage(ann.image_path);
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
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Society Announcements</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Latest news from student societies and clubs</p>
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
        <div className="mb-6 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 flex items-center gap-3">
          <Clock4 className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Pending Approval</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">Your Society Admin account is awaiting approval from a College Admin. You can view announcements but cannot publish until approved.</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{errorMsg}</p>
        </div>
      )}

      {showForm && canCreate && (
        <div className="mb-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{editingId ? 'Edit Announcement' : 'New Announcement'}</h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:bg-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Annual Tech Fest Registration" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Society Name</label>
              <input
                type="text"
                value={form.society_name}
                onChange={(e) => setForm({ ...form, society_name: e.target.value })}
                required
                readOnly={profile?.role === 'society_admin'}
                className={`w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none ${
                  profile?.role === 'society_admin' ? 'bg-slate-50 dark:bg-slate-900 cursor-not-allowed text-slate-600 dark:text-slate-300' : ''
                }`}
                placeholder="Coding Society"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Event Date</label>
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Event Time</label>
              <input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Registration Deadline</label>
              <input type="date" value={form.registration_deadline} onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Event Location</label>
              <input type="text" value={form.event_location} onChange={(e) => setForm({ ...form, event_location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Auditorium, Block C" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required rows={4}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Announcement details..." />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Registration URL (optional)</label>
              <input type="url" value={form.registration_url} onChange={(e) => setForm({ ...form, registration_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="https://forms.google.com/..." />
            </div>
            <div className="sm:col-span-2">
              <ImageUpload
                folder="announcements"
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Select branches to notify. Leave empty to notify all students. Announcement remains visible to everyone regardless.</p>
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Select years to notify. Leave empty to notify all students. Announcement remains visible to everyone regardless.</p>
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
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                {editingId ? 'Update' : 'Publish'}
              </button>
              <button type="button" onClick={resetForm}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:bg-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isStudent && announcementClashes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Schedule Clashes ({announcementClashes.length})</h2>
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
            <Megaphone className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 dark:text-slate-500">No announcements yet.</p>
          </div>
        ) : (
          announcements.map((ann, idx) => {
            const hasClash = clashedAnnouncementIds.has(ann.id);
            return (
            <div key={ann.id} id={idx === 0 ? 'latest-announcement' : undefined} className={`group bg-white dark:bg-slate-800 rounded-2xl border-2 p-5 shadow-sm transition-all ${
              hasClash ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700 hover:shadow-md'
            }`}>
              <div className={`flex gap-5 ${ann.image_path ? 'flex-col sm:flex-row' : ''}`}>
                {/* Details (left on desktop, top on mobile) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{ann.title}</h3>
                      {hasClash && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                          <AlertTriangle className="w-3 h-3" /> Clash Detected
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">
                        <Megaphone className="w-3 h-3" /> {ann.society_name}
                      </span>
                    </div>
                    {canDelete && (ann.created_by === profile?.id || profile?.role === 'college_admin') && (
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {ann.created_by === profile?.id && (
                          <button onClick={() => handleEdit(ann)} className="p-1.5 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:bg-teal-900/30">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(ann.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:bg-red-950/40">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{ann.content}</p>
                  <div className="mt-3 mb-3">
                    <TargetAudienceBadge branches={ann.target_branches} years={ann.target_years} />
                    {ann.target_interests && ann.target_interests.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Interests:</span>
                        {ann.target_interests.map((interest) => (
                          <span key={interest} className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">{interest}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-500 dark:text-slate-400">
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
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" /> Register by: {formatDate(ann.registration_deadline)}
                      </span>
                    )}
                    {ann.registration_url && (
                      <a href={ann.registration_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" /> Register / More Info
                      </a>
                    )}
                  </div>
                </div>
                {/* Image (right on desktop, below on mobile) */}
                {ann.image_path && (
                  <div className="sm:w-60 sm:flex-shrink-0">
                    <ImagePreview path={ann.image_path} alt={ann.title} maxHeight="max-h-60" />
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
