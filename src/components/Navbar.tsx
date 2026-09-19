import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Notification } from '@/lib/supabase';
import { GraduationCap, Menu, X, LogOut, LayoutDashboard, Calendar, Bell, Megaphone, Info, Users, ClipboardList, BellRing, ChevronDown, User, KeyRound, Sun, Moon, Sparkles } from 'lucide-react';
import CampusSyncBrand from '@/components/CampusSyncBrand';
import LoadingScreen from '@/components/LoadingScreen';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import InterestsModal from '@/components/InterestsModal';
import { useTheme } from '@/context/ThemeContext';

export default function Navbar() {
  const { session, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignOutLoader, setShowSignOutLoader] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showInterestsModal, setShowInterestsModal] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setShowProfileDropdown(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    setShowProfileDropdown(false);
    setShowSignOutLoader(true);
  };

  const completeSignOut = async () => {
    try {
      await signOut();
    } catch {
      // signOut handles its own errors internally; proceed with navigation
    } finally {
      setShowSignOutLoader(false);
      navigate('/');
    }
  };

  const isStudent = profile?.role === 'student';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
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

  const adminLink = (profile?.role === 'college_admin' && profile.approval_status === 'approved')
    ? { to: '/admin', label: 'Admin Panel', icon: ClipboardList }
    : profile?.role === 'primary_admin'
    ? { to: '/admin', label: 'Admin Panel', icon: ClipboardList }
    : profile?.role === 'society_admin'
    ? { to: '/society-admin', label: 'Society Panel', icon: Megaphone }
    : null;

  const roleLabel = profile?.role?.replace('_', ' ') ?? '';

  const profileDropdownContent = (
    <>
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{profile?.full_name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{roleLabel}</p>
          </div>
        </div>
        {profile?.email && (
          <p className="text-xs text-slate-400 mt-2 truncate">{profile.email}</p>
        )}
        {isStudent && profile?.branch && (
          <p className="text-xs text-slate-400 mt-1">
            {profile.branch}{profile.year ? ` · ${profile.year}` : ''}{profile.section ? ` · Sec ${profile.section}` : ''}
          </p>
        )}
        {profile?.role === 'society_admin' && profile?.society_name && (
          <p className="text-xs text-slate-400 mt-1">{profile.society_name}</p>
        )}
        {profile?.approval_status === 'pending' && (
          <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mt-2">Pending Approval</p>
        )}
        {profile?.approval_status === 'rejected' && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-2">Rejected</p>
        )}
      </div>
      <button
        onClick={toggleTheme}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>
      {isStudent && (
        <button
          onClick={() => { setShowProfileDropdown(false); setShowInterestsModal(true); }}
          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          My Interests
        </button>
      )}
      <button
        onClick={() => { setShowProfileDropdown(false); setShowChangePassword(true); }}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
      >
        <KeyRound className="w-4 h-4" />
        Change Password
      </button>
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </>
  );

  return (
    <nav className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center group" aria-label="CampusSync home">
            <CampusSyncBrand compact className="group-hover:scale-[1.02] transition-transform" />
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
                      ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
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
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
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
                      className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {unreadCount > 0 ? <BellRing className="w-5 h-5 text-teal-600 dark:text-teal-400" /> : <Bell className="w-5 h-5" />}
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                    {showNotifDropdown && (
                      <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-50">
                        <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</p>
                        </div>
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center">
                            <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 dark:text-slate-500">No notifications yet.</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {notifications.map((n) => (
                              <div key={n.id} className={`p-3 ${n.read ? 'bg-white dark:bg-slate-800' : 'bg-teal-50/50 dark:bg-teal-900/20'}`}>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.description}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center">
                      <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <span className="max-w-[120px] truncate">{profile?.full_name}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-50 overflow-hidden">
                      {profileDropdownContent}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  Login
                </Link>
                <Link to="/register" className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 dark:hover:bg-teal-500 transition-colors shadow-sm">
                  Register
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 lg:hidden">
            {session && isStudent && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => { setShowNotifDropdown(!showNotifDropdown); if (!showNotifDropdown) markAllRead(); }}
                  className="relative p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {unreadCount > 0 ? <BellRing className="w-5 h-5 text-teal-600 dark:text-teal-400" /> : <Bell className="w-5 h-5" />}
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {showNotifDropdown && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-50">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</p>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center">
                        <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-400 dark:text-slate-500">No notifications yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {notifications.map((n) => (
                          <div key={n.id} className={`p-3 ${n.read ? 'bg-white dark:bg-slate-800' : 'bg-teal-50/50 dark:bg-teal-900/20'}`}>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.description}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
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
                    active ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
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
                  location.pathname === adminLink.to ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <adminLink.icon className="w-4 h-4" />
                {adminLink.label}
              </Link>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              {session ? (
                <div className="px-1 py-1">
                  <div className="px-3 py-2.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{profile?.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{roleLabel}</p>
                    </div>
                  </div>
                  {isStudent && profile?.branch && (
                    <p className="px-3 pb-2 text-xs text-slate-400 dark:text-slate-500">
                      {profile.branch}{profile.year ? ` · ${profile.year}` : ''}{profile.section ? ` · Sec ${profile.section}` : ''}
                    </p>
                  )}
                  {profile?.role === 'society_admin' && profile?.society_name && (
                    <p className="px-3 pb-2 text-xs text-slate-400 dark:text-slate-500">{profile.society_name}</p>
                  )}
                  {profile?.approval_status === 'pending' && (
                    <p className="px-3 pb-2 text-xs font-medium text-orange-600 dark:text-orange-400">Pending Approval</p>
                  )}
                  {profile?.approval_status === 'rejected' && (
                    <p className="px-3 pb-2 text-xs font-medium text-red-600 dark:text-red-400">Rejected</p>
                  )}
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </button>
                  {isStudent && (
                    <button
                      onClick={() => { setMobileOpen(false); setShowInterestsModal(true); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      My Interests
                    </button>
                  )}
                  <button
                    onClick={() => { setMobileOpen(false); setShowChangePassword(true); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <KeyRound className="w-4 h-4" />
                    Change Password
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link to="/login" className="flex-1 text-center px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    Login
                  </Link>
                  <Link to="/register" className="flex-1 text-center px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 transition-colors">
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showSignOutLoader && (
        <LoadingScreen onComplete={completeSignOut} appReady={true} />
      )}
      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
      <InterestsModal open={showInterestsModal} onClose={() => setShowInterestsModal(false)} />
    </nav>
  );
}
