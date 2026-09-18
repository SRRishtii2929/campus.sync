import { useEffect, useState } from 'react';
import { supabase, type Notice } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/clashDetection';
import TargetAudienceBadge from '@/components/TargetAudienceBadge';
import { useHighlight } from '@/lib/useHighlight';
import { Plus, Trash2, Loader2, Bell, Pencil, X, FileText, AlertCircle, CheckCircle2, Calendar, Target } from 'lucide-react';
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

export default function Notices() {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    deadline: '',
    attachment_url: '',
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
    const { data } = await supabase.from('notices').select('*').order('date', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setForm({ title: '', description: '', date: new Date().toISOString().split('T')[0], deadline: '', attachment_url: '', target_branches: [], target_years: [], target_interests: [] });
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
    if (!form.title.trim() || !form.description.trim() || !form.date) {
      showError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    const targetBranches = form.target_branches.length > 0 ? form.target_branches : null;
    const targetYears = form.target_years.length > 0 ? form.target_years : null;
    const targetInterests = form.target_interests.length > 0 ? form.target_interests : null;

    let imagePath: string | null = editingImagePath;
    if (pendingImage) {
      const uploaded = await uploadImage(pendingImage, 'notices');
      if (uploaded) {
        if (editingImagePath) await deleteImage(editingImagePath);
        imagePath = uploaded;
      }
    } else if (removedImage) {
      if (editingImagePath) await deleteImage(editingImagePath);
      imagePath = null;
    }

    if (editingId) {
      const { error } = await supabase.from('notices').update({
        title: form.title,
        description: form.description,
        date: form.date,
        deadline: form.deadline || null,
        attachment_url: form.attachment_url || null,
        image_path: imagePath,
        target_branches: targetBranches,
        target_years: targetYears,
        target_interests: targetInterests,
      }).eq('id', editingId);
      if (error) {
        showError('Failed to update notice: ' + error.message);
        setSubmitting(false);
        return;
      }
      showSuccess('Notice updated successfully!');
    } else {
      const { data: insertData, error } = await supabase.from('notices').insert({
        title: form.title,
        description: form.description,
        date: form.date,
        deadline: form.deadline || null,
        attachment_url: form.attachment_url || null,
        image_path: imagePath,
        target_branches: targetBranches,
        target_years: targetYears,
        target_interests: targetInterests,
      }).select('id');
      if (error) {
        showError('Failed to publish notice: ' + error.message);
        setSubmitting(false);
        return;
      }
      if (insertData && insertData[0]) {
        const { data: sessionData } = await supabase.auth.getSession();
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-targeted-students`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({ notice_id: insertData[0].id }),
        }).catch(() => {});
      }
      showSuccess('Notice published successfully!');
    }
    setSubmitting(false);
    resetForm();
    loadData();
  }

  function handleEdit(notice: Notice) {
    setForm({
      title: notice.title,
      description: notice.description,
      date: notice.date,
      deadline: notice.deadline || '',
      attachment_url: notice.attachment_url || '',
      target_branches: notice.target_branches || [],
      target_years: notice.target_years || [],
      target_interests: notice.target_interests || [],
    });
    setEditingId(notice.id);
    setEditingImagePath(notice.image_path);
    setPendingImage(null);
    setRemovedImage(false);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this notice? This cannot be undone.')) return;
    const notice = notices.find((n) => n.id === id);
    if (notice?.image_path) await deleteImage(notice.image_path);
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) { showError('Error: ' + error.message); return; }
    showSuccess('Notice deleted.');
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
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">College Notices</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Official notices from college administration</p>
        </div>
        {isCollegeAdmin && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Publish Notice
          </button>
        )}
      </div>

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

      {showForm && isCollegeAdmin && (
        <div className="mb-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{editingId ? 'Edit Notice' : 'Publish New Notice'}</h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:bg-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notice Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Important Announcement" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description *</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Notice details..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deadline (if applicable)</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Attachment URL (optional)</label>
              <input type="url" value={form.attachment_url} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="https://..." />
            </div>
            <div className="sm:col-span-2">
              <ImageUpload
                folder="notices"
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Select branches to notify. Leave empty to notify all students. Notice remains visible to everyone regardless.</p>
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Select years to notify. Leave empty to notify all students. Notice remains visible to everyone regardless.</p>
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
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                {editingId ? 'Update Notice' : 'Publish Notice'}
              </button>
              <button type="button" onClick={resetForm}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:bg-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {notices.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 dark:text-slate-500">No notices published yet.</p>
          </div>
        ) : (
          notices.map((notice, idx) => (
            <div key={notice.id} id={idx === 0 ? 'latest-notice' : undefined} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all">
              <div className={`flex gap-5 ${notice.image_path ? 'flex-col sm:flex-row' : ''}`}>
                {/* Details (left on desktop, top on mobile) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{notice.title}</h3>
                    {isCollegeAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => handleEdit(notice)} className="p-1.5 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:bg-teal-900/30">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(notice.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:bg-red-950/40">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{notice.description}</p>
                  <div className="mt-3 mb-3">
                    <TargetAudienceBadge branches={notice.target_branches} years={notice.target_years} />
                    {notice.target_interests && notice.target_interests.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Interests:</span>
                        {notice.target_interests.map((interest) => (
                          <span key={interest} className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">{interest}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(notice.date)}</span>
                    {notice.deadline && (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" /> Deadline: {formatDate(notice.deadline)}
                      </span>
                    )}
                    {notice.attachment_url && (
                      <a href={notice.attachment_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline">
                        <FileText className="w-3.5 h-3.5" /> View Attachment
                      </a>
                    )}
                  </div>
                </div>
                {/* Image (right on desktop, below on mobile) */}
                {notice.image_path && (
                  <div className="sm:w-64 sm:flex-shrink-0">
                    <ImagePreview path={notice.image_path} alt={notice.title} maxHeight="max-h-64" />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
