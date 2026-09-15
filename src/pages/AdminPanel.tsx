import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Notice, type EventEntry, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/clashDetection';
import { Bell, Users, ClipboardList, TrendingUp, Calendar, AlertCircle, CheckCircle2, XCircle, Loader2, UserCheck, Clock, Trash2, UserCog, Shield } from 'lucide-react';

export default function AdminPanel() {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [allAccounts, setAllAccounts] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  useEffect(() => {
    async function loadData() {
      const [noticesRes, eventsRes, pendingRes, accountsRes] = await Promise.all([
        supabase.from('notices').select('*').order('date', { ascending: false }),
        supabase.from('events').select('*').order('date'),
        supabase.from('profiles').select('*').in('approval_status', ['pending', 'rejected']).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').in('role', ['student', 'society_admin']).order('created_at', { ascending: false }),
      ]);
      setNotices(noticesRes.data || []);
      setEvents(eventsRes.data || []);
      setPendingUsers(pendingRes.data || []);
      setAllAccounts(accountsRes.data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  async function handleApprove(userId: string) {
    setApproving(userId);
    const { error } = await supabase.from('profiles').update({ approval_status: 'approved' }).eq('id', userId);
    if (!error) {
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
    }
    setApproving(null);
  }

  async function handleReject(userId: string) {
    setApproving(userId);
    const { error } = await supabase.from('profiles').update({ approval_status: 'rejected' }).eq('id', userId);
    if (!error) {
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
    }
    setApproving(null);
  }

  async function handleDeleteAccount(userId: string, displayName: string) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete this account? The profile and login credentials will be permanently removed.`
    );
    if (!confirmed) return;

    setDeleting(userId);
    setDeleteError('');
    setDeleteSuccess('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ target_user_id: userId }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Request failed (${response.status})`);
      }

      setAllAccounts((prev) => prev.filter((a) => a.id !== userId));
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      setDeleteSuccess(`Account "${displayName}" permanently deleted. The user can no longer log in.`);
      setTimeout(() => setDeleteSuccess(''), 5000);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
      setTimeout(() => setDeleteError(''), 5000);
    }

    setDeleting(null);
  }

  const pendingSocietyAdmins = pendingUsers.filter((u) => u.role === 'society_admin');
  const pendingCRs = pendingUsers.filter((u) => u.student_type === 'cr');

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">College Admin Panel</h1>
        <p className="text-slate-500 mt-1">Manage notices, events, and approvals · {profile?.full_name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Bell className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{notices.length}</p>
              <p className="text-sm text-slate-500">Total Notices</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{events.length}</p>
              <p className="text-sm text-slate-500">Total Events</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{events.filter(e => new Date(e.date) >= new Date(new Date().toDateString())).length}</p>
              <p className="text-sm text-slate-500">Upcoming Events</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{pendingUsers.length}</p>
              <p className="text-sm text-slate-500">Pending Approvals</p>
            </div>
          </div>
        </div>
      </div>

      {(pendingSocietyAdmins.length > 0 || pendingCRs.length > 0) && (
        <div className="mb-6 space-y-6">
          {pendingSocietyAdmins.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-slate-800">Society Admin Approval Requests</h2>
              </div>
              <div className="space-y-3">
                {pendingSocietyAdmins.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-orange-50/30">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{u.full_name}</p>
                      <p className="text-xs text-slate-500">{u.email} · {u.department} · Registered {formatDate(u.created_at.split('T')[0])}</p>
                      {u.approval_status === 'rejected' && <span className="text-xs text-red-600 font-medium">Previously rejected</span>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(u.id)}
                        disabled={approving === u.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {approving === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(u.id)}
                        disabled={approving === u.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingCRs.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-slate-800">CR (Class Representative) Approval Requests</h2>
              </div>
              <div className="space-y-3">
                {pendingCRs.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-orange-50/30">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{u.full_name}</p>
                      <p className="text-xs text-slate-500">{u.email} · {u.branch} · {u.year} · Section {u.section}</p>
                      {u.approval_status === 'rejected' && <span className="text-xs text-red-600 font-medium">Previously rejected</span>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(u.id)}
                        disabled={approving === u.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {approving === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(u.id)}
                        disabled={approving === u.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-slate-800">Notice Management</h2>
            </div>
            <Link to="/notices" className="text-sm text-teal-600 hover:underline">Manage →</Link>
          </div>
          {notices.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No notices published yet.</p>
          ) : (
            <div className="space-y-2">
              {notices.slice(0, 5).map((n) => (
                <div key={n.id} className="p-3 rounded-lg border border-slate-200 bg-amber-50/30">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.department} · {formatDate(n.date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              <h2 className="text-lg font-semibold text-slate-800">Event Management</h2>
            </div>
            <Link to="/events" className="text-sm text-teal-600 hover:underline">Manage →</Link>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No events created yet.</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 5).map((e) => (
                <div key={e.id} className="p-3 rounded-lg border border-slate-200 bg-teal-50/30">
                  <p className="text-sm font-medium text-slate-800">{e.title}</p>
                  <p className="text-xs text-slate-500">{formatDate(e.date)} · {e.location}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Account Management */}
      <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <UserCog className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-800">Account Management</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">View and manage all student and society admin accounts. Deletion is permanent and removes login credentials.</p>

        {deleteError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{deleteError}</p>
          </div>
        )}
        {deleteSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">{deleteSuccess}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-2 font-medium">Name / Society</th>
                <th className="py-3 px-2 font-medium">Email</th>
                <th className="py-3 px-2 font-medium">Role</th>
                <th className="py-3 px-2 font-medium">Details</th>
                <th className="py-3 px-2 font-medium">Status</th>
                <th className="py-3 px-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">No student or society admin accounts found.</td>
                </tr>
              ) : (
                allAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50">
                    <td className="py-3 px-2 font-medium text-slate-800">
                      {acc.role === 'society_admin' ? (acc.society_name || acc.full_name) : acc.full_name}
                    </td>
                    <td className="py-3 px-2 text-slate-600">{acc.email}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        acc.role === 'society_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {acc.role === 'society_admin' ? 'Society Admin' : 'Student'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs text-slate-500">
                      {acc.role === 'student' ? (
                        `${acc.branch || '-'} · ${acc.year || '-'} · Sec ${acc.section || '-'}${acc.student_type === 'cr' ? ' · CR' : ''}`
                      ) : (
                        acc.department || '-'
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        acc.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
                        acc.approval_status === 'pending' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {acc.approval_status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                        {acc.approval_status === 'pending' && <Clock className="w-3 h-3" />}
                        {acc.approval_status === 'rejected' && <XCircle className="w-3 h-3" />}
                        {acc.approval_status || 'approved'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleDeleteAccount(acc.id, acc.role === 'society_admin' ? (acc.society_name || acc.full_name) : acc.full_name)}
                        disabled={deleting === acc.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {deleting === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <Shield className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500">Deleting an account permanently removes the profile and login credentials. The user will no longer be able to sign in. This action cannot be undone.</p>
        </div>
      </div>

      <div className="mt-6 bg-teal-50 rounded-2xl border border-teal-200 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Admin Capabilities</h3>
            <ul className="text-sm text-slate-600 mt-2 space-y-1">
              <li>• Create, edit, and delete official college notices</li>
              <li>• Create, edit, and delete college events</li>
              <li>• Approve or reject Society Admin and CR requests</li>
              <li>• Manage and permanently delete student and society admin accounts</li>
              <li>• View all student timetables for reference</li>
              <li>• Notices are visible to all students and society administrators</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
