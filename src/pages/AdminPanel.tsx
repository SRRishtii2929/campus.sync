import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Notice, type EventEntry, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/clashDetection';
import { Bell, Users, ClipboardList, TrendingUp, Calendar, AlertCircle, CheckCircle2, XCircle, Loader2, UserCheck, Clock, Trash2, UserCog, Shield, ShieldCheck, Crown } from 'lucide-react';

export default function AdminPanel() {
  const { profile } = useAuth();
  const isPrimaryAdmin = profile?.role === 'primary_admin';
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [allAccounts, setAllAccounts] = useState<Profile[]>([]);
  const [pendingCollegeAdmins, setPendingCollegeAdmins] = useState<Profile[]>([]);
  const [primaryAdmins, setPrimaryAdmins] = useState<Profile[]>([]);
  const [collegeAdmins, setCollegeAdmins] = useState<Profile[]>([]);
  const [primaryAdminCount, setPrimaryAdminCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    async function loadData() {
      const queries = [
        supabase.from('notices').select('*').order('date', { ascending: false }),
        supabase.from('events').select('*').order('date'),
        supabase.from('profiles').select('*').in('approval_status', ['pending', 'rejected']).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').in('role', ['student', 'society_admin']).order('created_at', { ascending: false }),
      ];

      if (isPrimaryAdmin) {
        queries.push(
          supabase.from('profiles').select('*').eq('role', 'college_admin').eq('approval_status', 'pending').order('created_at', { ascending: false }),
        );
        queries.push(
          supabase.from('profiles').select('*').eq('role', 'primary_admin').order('created_at', { ascending: false }),
        );
        queries.push(
          supabase.from('profiles').select('*').eq('role', 'college_admin').eq('approval_status', 'approved').order('created_at', { ascending: false }),
        );
      }

        const [noticeRes, eventRes, pendingRes, accountRes, pendingAdminRes, primaryAdminRes, collegeAdminRes] = await Promise.all(queries);
        setNotices(noticeRes.data || []);
        setEvents(eventRes.data || []);
        setPendingUsers(pendingRes.data || []);
        setAllAccounts(accountRes.data || []);

        if (isPrimaryAdmin) {
          setPendingCollegeAdmins(pendingAdminRes.data || []);
          setPrimaryAdmins(primaryAdminRes.data || []);
          setCollegeAdmins(collegeAdminRes.data || []);
          const countRes = await supabase.rpc('get_primary_admin_count');
          setPrimaryAdminCount((countRes.data as number) ?? 0);
        }

      setLoading(false);
    }
    loadData();
  }, [isPrimaryAdmin]);

  async function handleApprove(userId: string) {
    setApproving(userId);
    setActionError('');
    setActionSuccess('');
    const { error } = await supabase.from('profiles').update({ approval_status: 'approved' }).eq('id', userId);
    if (!error) {
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      setActionSuccess('Society Admin / CR approved successfully.');
      setTimeout(() => setActionSuccess(''), 5000);
    } else {
      setActionError(error.message);
      setTimeout(() => setActionError(''), 5000);
    }
    setApproving(null);
  }

  async function handleReject(userId: string) {
    setApproving(userId);
    setActionError('');
    setActionSuccess('');
    const { error } = await supabase.from('profiles').update({ approval_status: 'rejected' }).eq('id', userId);
    if (!error) {
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      setActionSuccess('Request rejected.');
      setTimeout(() => setActionSuccess(''), 5000);
    } else {
      setActionError(error.message);
      setTimeout(() => setActionError(''), 5000);
    }
    setApproving(null);
  }

  async function handleApproveCollegeAdmin(userId: string, email: string) {
    setApproving(userId);
    setActionError('');
    setActionSuccess('');
    const { data, error } = await supabase.rpc('approve_college_admin', { target_user_id: userId });

    if (error) {
      setActionError(error.message);
      setTimeout(() => setActionError(''), 5000);
      setApproving(null);
      return;
    }

    if (data && data.startsWith('ERROR')) {
      setActionError(data.replace('ERROR: ', ''));
      setTimeout(() => setActionError(''), 5000);
      setApproving(null);
      return;
    }

    setPendingCollegeAdmins((prev) => prev.filter((u) => u.id !== userId));
    setActionSuccess(`College Admin "${email}" approved successfully.`);
    setTimeout(() => setActionSuccess(''), 5000);

    // Send approval notification email (best-effort)
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (accessToken) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ type: 'college_admin_approved', to_email: email }),
        }).catch(() => {});
      }
    } catch { /* best-effort */ }

    setApproving(null);
  }

  async function handleRejectCollegeAdmin(userId: string, email: string) {
    setApproving(userId);
    setActionError('');
    setActionSuccess('');
    const { data, error } = await supabase.rpc('reject_college_admin', { target_user_id: userId });

    if (error) {
      setActionError(error.message);
      setTimeout(() => setActionError(''), 5000);
      setApproving(null);
      return;
    }

    if (data && data.startsWith('ERROR')) {
      setActionError(data.replace('ERROR: ', ''));
      setTimeout(() => setActionError(''), 5000);
      setApproving(null);
      return;
    }

    setPendingCollegeAdmins((prev) => prev.filter((u) => u.id !== userId));
    setActionSuccess(`College Admin "${email}" rejected.`);
    setTimeout(() => setActionSuccess(''), 5000);

    // Send rejection notification email (best-effort)
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (accessToken) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ type: 'college_admin_rejected', to_email: email }),
        }).catch(() => {});
      }
    } catch { /* best-effort */ }

    setApproving(null);
  }

  async function handlePromotePrimaryAdmin(userId: string, email: string) {
    setPromoting(userId);
    setActionError('');
    setActionSuccess('');
    const { data, error } = await supabase.rpc('promote_to_primary_admin', { target_user_id: userId });

    if (error) {
      setActionError(error.message);
      setTimeout(() => setActionError(''), 5000);
      setPromoting(null);
      return;
    }

    if (data && data.startsWith('ERROR')) {
      setActionError(data.replace('ERROR: ', ''));
      setTimeout(() => setActionError(''), 5000);
      setPromoting(null);
      return;
    }

    // Refresh primary admin list and count
    const [paRes, countRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'primary_admin').order('created_at', { ascending: false }),
      supabase.rpc('get_primary_admin_count'),
    ]);
    setPrimaryAdmins(paRes.data || []);
    setPrimaryAdminCount((countRes.data as number) ?? 0);
    setCollegeAdmins((prev) => prev.filter((a) => a.id !== userId));
    setActionSuccess(`"${email}" promoted to Primary Admin.`);
    setTimeout(() => setActionSuccess(''), 5000);
    setPromoting(null);
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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error('Your admin session has expired. Please sign in again.');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
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
      setCollegeAdmins((prev) => prev.filter((a) => a.id !== userId));
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
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
          {isPrimaryAdmin ? 'Primary Admin Panel' : 'College Admin Panel'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage notices, events, and approvals · {profile?.full_name}</p>
      </div>

      {(actionError || deleteError) && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{actionError || deleteError}</p>
        </div>
      )}
      {(actionSuccess || deleteSuccess) && (
        <div className="mb-6 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-300">{actionSuccess || deleteSuccess}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <Bell className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{notices.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Notices</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
              <Users className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{events.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Events</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{events.filter(e => new Date(e.date) >= new Date(new Date().toDateString())).length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Upcoming Events</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{pendingUsers.length + (isPrimaryAdmin ? pendingCollegeAdmins.length : 0)}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pending Approvals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Admin Section: Pending College Admin Approvals */}
      {isPrimaryAdmin && (
        <div className="mb-6 space-y-6">
          {pendingCollegeAdmins.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-orange-200 dark:border-orange-800 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Administrator Requests</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Pending College Admins: {pendingCollegeAdmins.length}</p>
              <div className="space-y-3">
                {pendingCollegeAdmins.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-orange-50/30">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{u.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Registered {formatDate(u.created_at.split('T')[0])}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveCollegeAdmin(u.id, u.email)}
                        disabled={approving === u.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {approving === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectCollegeAdmin(u.id, u.email)}
                        disabled={approving === u.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50"
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

          {/* Primary Administrators List (View-Only) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Primary Administrators</h2>
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{primaryAdminCount} / 4</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-2 font-medium">Name</th>
                    <th className="py-3 px-2 font-medium">Email</th>
                    <th className="py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {primaryAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 dark:text-slate-500">No Primary Admin accounts found.</td>
                    </tr>
                  ) : (
                    primaryAdmins.map((pa) => (
                      <tr key={pa.id} className="hover:bg-slate-50 dark:bg-slate-900">
                        <td className="py-3 px-2 font-medium text-slate-800 dark:text-slate-200">{pa.full_name}</td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-300">{pa.email}</td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                            <CheckCircle2 className="w-3 h-3" />
                            {pa.approval_status || 'approved'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <Shield className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 dark:text-slate-400">This list is view-only. Primary Admin accounts cannot be edited, deleted, or modified by other administrators.</p>
            </div>
          </div>

          {/* College Admin Management (promote to Primary) */}
          {collegeAdmins.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <UserCog className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">College Admin Management</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Manage approved College Admin accounts. Promote to Primary Admin (max 4 active).</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-2 font-medium">Name</th>
                      <th className="py-3 px-2 font-medium">Email</th>
                      <th className="py-3 px-2 font-medium">Status</th>
                      <th className="py-3 px-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {collegeAdmins.map((ca) => (
                      <tr key={ca.id} className="hover:bg-slate-50 dark:bg-slate-900">
                        <td className="py-3 px-2 font-medium text-slate-800 dark:text-slate-200">{ca.full_name}</td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-300">{ca.email}</td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                            <CheckCircle2 className="w-3 h-3" />
                            active
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => handlePromotePrimaryAdmin(ca.id, ca.email)}
                            disabled={promoting === ca.id || primaryAdminCount >= 4}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors disabled:opacity-50"
                            title={primaryAdminCount >= 4 ? 'Maximum Primary Admins reached' : 'Promote to Primary Admin'}
                          >
                            {promoting === ca.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                            {primaryAdminCount >= 4 ? 'Limit Reached' : 'Promote'}
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(ca.id, ca.full_name)}
                            disabled={deleting === ca.id}
                            className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                          >
                            {deleting === ca.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Society Admin & CR Approval Requests (both roles can see these) */}
      {(pendingSocietyAdmins.length > 0 || pendingCRs.length > 0) && (
        <div className="mb-6 space-y-6">
          {pendingSocietyAdmins.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Society Admin Approval Requests</h2>
              </div>
              <div className="space-y-3">
                {pendingSocietyAdmins.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-orange-50/30">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{u.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{u.email} · Registered {formatDate(u.created_at.split('T')[0])}</p>
                      {u.approval_status === 'rejected' && <span className="text-xs text-red-600 dark:text-red-400 font-medium">Previously rejected</span>}
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
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50"
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
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">CR (Class Representative) Approval Requests</h2>
              </div>
              <div className="space-y-3">
                {pendingCRs.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-orange-50/30">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{u.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{u.email} · {u.branch} · {u.year} · Section {u.section}</p>
                      {u.approval_status === 'rejected' && <span className="text-xs text-red-600 dark:text-red-400 font-medium">Previously rejected</span>}
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
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50"
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Notice Management</h2>
            </div>
            <Link to="/notices" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">Manage →</Link>
          </div>
          {notices.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">No notices published yet.</p>
          ) : (
            <div className="space-y-2">
              {notices.slice(0, 5).map((n) => (
                <div key={n.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-amber-50/30">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(n.date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Event Management</h2>
            </div>
            <Link to="/events" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">Manage →</Link>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">No events created yet.</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 5).map((e) => (
                <div key={e.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-teal-50/30 dark:bg-teal-900/20">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{e.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(e.date)} · {e.location}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Account Management */}
      <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <UserCog className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Account Management</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">View and manage all student and society admin accounts. Deletion is permanent and removes login credentials.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-2 font-medium">Name / Society</th>
                <th className="py-3 px-2 font-medium">Email</th>
                <th className="py-3 px-2 font-medium">Role</th>
                <th className="py-3 px-2 font-medium">Details</th>
                <th className="py-3 px-2 font-medium">Status</th>
                <th className="py-3 px-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {allAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">No student or society admin accounts found.</td>
                </tr>
              ) : (
                allAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50 dark:bg-slate-900">
                    <td className="py-3 px-2 font-medium text-slate-800 dark:text-slate-200">
                      {acc.role === 'society_admin' ? (acc.society_name || acc.full_name) : acc.full_name}
                    </td>
                    <td className="py-3 px-2 text-slate-600 dark:text-slate-300">{acc.email}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        acc.role === 'society_admin' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      }`}>
                        {acc.role === 'society_admin' ? 'Society Admin' : 'Student'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs text-slate-500 dark:text-slate-400">
                      {acc.role === 'student' ? (
                        `${acc.branch || '-'} · ${acc.year || '-'} · Sec ${acc.section || '-'}${acc.student_type === 'cr' ? ' · CR' : ''}`
                      ) : (
                        acc.society_name || '-'
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        acc.approval_status === 'approved' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                        acc.approval_status === 'pending' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' :
                        'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
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
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
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

        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <Shield className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Deleting an account permanently removes the profile and login credentials. The user will no longer be able to sign in. This action cannot be undone.</p>
        </div>
      </div>

      <div className="mt-6 bg-teal-50 dark:bg-teal-900/30 rounded-2xl border border-teal-200 dark:border-teal-800 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {isPrimaryAdmin ? 'Primary Admin Capabilities' : 'Admin Capabilities'}
            </h3>
            <ul className="text-sm text-slate-600 dark:text-slate-300 mt-2 space-y-1">
              <li>• Create, edit, and delete official college notices</li>
              <li>• Create, edit, and delete college events</li>
              <li>• Approve or reject Society Admin and CR requests</li>
              <li>• Manage and permanently delete student and society admin accounts</li>
              <li>• Notices are visible to all students and society administrators</li>
              {isPrimaryAdmin && (
                <>
                  <li>• Approve or reject pending College Admin registrations</li>
                  <li>• Promote approved College Admins to Primary Admin (max 4)</li>
                  <li>• View the list of all Primary Administrators (view-only)</li>
                  <li>• Manage and delete normal College Admin accounts</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
