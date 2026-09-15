import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Notice, type EventEntry, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/clashDetection';
import { Bell, Users, ClipboardList, TrendingUp, Calendar, AlertCircle, CheckCircle2, XCircle, Loader2, UserCheck, Clock } from 'lucide-react';

export default function AdminPanel() {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const [noticesRes, eventsRes, pendingRes] = await Promise.all([
        supabase.from('notices').select('*').order('date', { ascending: false }),
        supabase.from('events').select('*').order('date'),
        supabase.from('profiles').select('*').in('approval_status', ['pending', 'rejected']).order('created_at', { ascending: false }),
      ]);
      setNotices(noticesRes.data || []);
      setEvents(eventsRes.data || []);
      setPendingUsers(pendingRes.data || []);
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

      <div className="mt-6 bg-teal-50 rounded-2xl border border-teal-200 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Admin Capabilities</h3>
            <ul className="text-sm text-slate-600 mt-2 space-y-1">
              <li>• Create, edit, and delete official college notices</li>
              <li>• Create, edit, and delete college events</li>
              <li>• Approve or reject Society Admin and CR requests</li>
              <li>• View all student timetables for reference</li>
              <li>• Notices are visible to all students and society administrators</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
