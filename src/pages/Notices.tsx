import { useEffect, useState } from 'react';
import { supabase, type Notice } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/clashDetection';
import TargetAudienceBadge from '@/components/TargetAudienceBadge';
import { useHighlight } from '@/lib/useHighlight';
import { Plus, Trash2, Loader2, Bell, Pencil, X, FileText, AlertCircle, CheckCircle2, Building, Calendar, Target } from 'lucide-react';

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
    department: 'All',
    deadline: '',
    attachment_url: '',
    target_branches: [] as string[],
    target_years: [] as string[],
  });

  const isCollegeAdmin = profile?.role === 'college_admin';
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
    setForm({ title: '', description: '', date: new Date().toISOString().split('T')[0], department: 'All', deadline: '', attachment_url: '', target_branches: [], target_years: [] });
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
    if (!form.title.trim() || !form.description.trim() || !form.date) {
      showError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    const targetBranches = form.target_branches.length > 0 ? form.target_branches : null;
    const targetYears = form.target_years.length > 0 ? form.target_years : null;
    if (editingId) {
      const { error } = await supabase.from('notices').update({
        title: form.title,
        description: form.description,
        date: form.date,
        department: form.department,
        deadline: form.deadline || null,
        attachment_url: form.attachment_url || null,
        target_branches: targetBranches,
        target_years: targetYears,
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
        department: form.department,
        deadline: form.deadline || null,
        attachment_url: form.attachment_url || null,
        target_branches: targetBranches,
        target_years: targetYears,
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
      department: notice.department,
      deadline: notice.deadline || '',
      attachment_url: notice.attachment_url || '',
      target_branches: notice.target_branches || [],
      target_years: notice.target_years || [],
    });
    setEditingId(notice.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this notice? This cannot be undone.')) return;
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
          <h1 className="text-3xl font-bold text-slate-800">College Notices</h1>
          <p className="text-slate-500 mt-1">Official notices from college administration</p>
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

      {showForm && isCollegeAdmin && (
        <div className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">{editingId ? 'Edit Notice' : 'Publish New Notice'}</h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notice Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Important Announcement" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="Notice details..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department / Target Audience</label>
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none">
                <option value="All">All Departments</option>
                <option value="Mathematics and Computing">Mathematics and Computing</option>
                <option value="Engineering">Engineering</option>
                <option value="Sciences">Sciences</option>
                <option value="Humanities">Humanities</option>
                <option value="Administration">Administration</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deadline (if applicable)</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Attachment URL (optional)</label>
              <input type="url" value={form.attachment_url} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
                placeholder="https://..." />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-4 h-4 text-teal-600" />
                <label className="block text-sm font-medium text-slate-700">Target Branches (for notifications)</label>
              </div>
              <p className="text-xs text-slate-400 mb-2">Select branches to notify. Leave empty to notify all students. Notice remains visible to everyone regardless.</p>
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
              <p className="text-xs text-slate-400 mb-2">Select years to notify. Leave empty to notify all students. Notice remains visible to everyone regardless.</p>
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
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                {editingId ? 'Update Notice' : 'Publish Notice'}
              </button>
              <button type="button" onClick={resetForm}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {notices.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400">No notices published yet.</p>
          </div>
        ) : (
          notices.map((notice, idx) => (
            <div key={notice.id} id={idx === 0 ? 'latest-notice' : undefined} className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="text-lg font-semibold text-slate-800">{notice.title}</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <Building className="w-3 h-3" /> {notice.department}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{notice.description}</p>
                  <div className="mt-3 mb-3">
                    <TargetAudienceBadge branches={notice.target_branches} years={notice.target_years} />
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(notice.date)}</span>
                    {notice.deadline && (
                      <span className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" /> Deadline: {formatDate(notice.deadline)}
                      </span>
                    )}
                    {notice.attachment_url && (
                      <a href={notice.attachment_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-teal-600 hover:underline">
                        <FileText className="w-3.5 h-3.5" /> View Attachment
                      </a>
                    )}
                  </div>
                </div>
                {isCollegeAdmin && (
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(notice)} className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(notice.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
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
