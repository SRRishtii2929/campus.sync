import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Announcement } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/clashDetection';
import { Megaphone, TrendingUp, AlertCircle, Clock4, CheckCircle2, XCircle } from 'lucide-react';

export default function SocietyPanel() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('announcements').select('*').order('date', { ascending: false });
      setAnnouncements(data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  const myAnnouncements = announcements.filter((a) => a.created_by === profile?.id);
  const isApproved = profile?.approval_status === 'approved';
  const isPending = profile?.approval_status === 'pending';
  const isRejected = profile?.approval_status === 'rejected';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Society Admin Panel</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your society announcements · {profile?.society_name || profile?.full_name}</p>
      </div>

      <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
        isApproved ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800' :
        isPending ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800' :
        'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'
      }`}>
        {isApproved ? <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" /> :
         isPending ? <Clock4 className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" /> :
         <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
        <div>
          {isApproved && <p className="text-sm font-medium text-green-800">Approved — You can publish and manage announcements.</p>}
          {isPending && <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Pending Approval — Your account is awaiting College Admin approval. You cannot publish until approved.</p>}
          {isRejected && <p className="text-sm font-medium text-red-800">Rejected — Your Society Admin request was rejected. Please contact a College Admin.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{myAnnouncements.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">My Announcements</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{announcements.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Announcements</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Announcement Management</h2>
          </div>
          {isApproved && <Link to="/announcements" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">Manage →</Link>}
        </div>
        {myAnnouncements.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">You haven't published any announcements yet.</p>
        ) : (
          <div className="space-y-2">
            {myAnnouncements.map((a) => (
              <div key={a.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-purple-50/30">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{a.society_name} · {formatDate(a.date)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-200 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Society Admin Capabilities</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-300 mt-2 space-y-1">
              <li>• Create, edit, and delete society announcements {isApproved ? '' : '(requires approval)'}</li>
              <li>• Target announcements to specific branches and years for notifications</li>
              <li>• Announcements are visible to all students</li>
              <li>• Manage your society's public communications</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
