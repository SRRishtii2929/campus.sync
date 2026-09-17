import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Notification } from '@/lib/supabase';
import { GraduationCap, Menu, X, LogOut, LayoutDashboard, Calendar, Bell, Megaphone, Info, Users, ClipboardList, BellRing } from 'lucide-react';

export default function Navbar() {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isStudent = profile?.role === 'student';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!isStudent) return;
    async function loadNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications(data || []);
    }
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [isStudent]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const navLinks = session ? [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(isStudent ? [{ to: '/timetable', label: 'Timetable', icon: Calendar }] : []),
    { to: '/events', label: 'Events', icon: Users },
    { to: '/notices', label: 'Notices', icon: Bell },
    { to: '/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/about', label: 'About', icon: Info },
  ] : [
    { to: '/', label: 'Home', icon: GraduationCap },
    { to: '/about', label: 'About', icon: Info },
  ];

  const adminLink = profile?.role === 'college_admin'
    ? { to: '/admin', label: 'Admin Panel', icon: ClipboardList }
    : profile?.role === 'society_admin'
    ? { to: '/society-admin', label: 'Society Panel', icon: Megaphone }
    : null;

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 group" aria-label="Campus Sync home">
            <img src="/image copy.png" alt="" className="w-10 h-10 object-contain group-hover:scale-[1.04] transition-transform" />
            <img src="/image copy 2.png" alt="CampusSync — Notices · Events · Opportunities" className="w-32 sm:w-36 h-12 object-contain" />
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
            {adminLink && (
              <Link
                to={adminLink.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === adminLink.to
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <adminLink.icon className="w-4 h-4" />
                {adminLink.label}
              </Link>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {session ? (
              <>
                {isStudent && (
                  <div className="relative" ref={notifRef}>
                    <button
                      onClick={() => { setShowNotifDropdown(!showNotifDropdown); if (!showNotifDropdown) markAllRead(); }}
                      className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      {unreadCount > 0 ? <BellRing className="w-5 h-5 text-teal-600" /> : <Bell className="w-5 h-5" />}
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                    {showNotifDropdown && (
                      <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-lg z-50">
                        <div className="p-3 border-b border-slate-100">
                          <p className="text-sm font-semibold text-slate-800">Notifications</p>
                        </div>
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center">
                            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-400">No notifications yet.</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-50">
                            {notifications.map((n) => (
                              <div key={n.id} className={`p-3 ${n.read ? 'bg-white' : 'bg-teal-50/50'}`}>
                                <p className="text-sm font-medium text-slate-800">{n.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.description}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <span className="text-sm text-slate-500">
                  {profile?.full_name} · <span className="capitalize text-teal-600 font-medium">{profile?.role?.replace('_', ' ')}</span>
                  {profile?.approval_status === 'pending' && (
                    <span className="ml-1 text-xs font-medium text-orange-600">(Pending Approval)</span>
                  )}
                  {profile?.approval_status === 'rejected' && (
                    <span className="ml-1 text-xs font-medium text-red-600">(Rejected)</span>
                  )}
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  Login
                </Link>
                <Link to="/register" className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm">
                  Register
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden pb-4 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
            {adminLink && (
              <Link
                to={adminLink.to}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === adminLink.to ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <adminLink.icon className="w-4 h-4" />
                {adminLink.label}
              </Link>
            )}
            <div className="pt-2 border-t border-slate-200">
              {session ? (
                <>
                  <div className="px-3 py-2 text-sm text-slate-500">
                    {profile?.full_name} · <span className="capitalize text-teal-600 font-medium">{profile?.role?.replace('_', ' ')}</span>
                    {profile?.approval_status === 'pending' && (
                      <span className="block text-xs font-medium text-orange-600 mt-0.5">Pending Approval</span>
                    )}
                    {profile?.approval_status === 'rejected' && (
                      <span className="block text-xs font-medium text-red-600 mt-0.5">Rejected</span>
                    )}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <Link to="/login" className="flex-1 text-center px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                    Login
                  </Link>
                  <Link to="/register" className="flex-1 text-center px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
