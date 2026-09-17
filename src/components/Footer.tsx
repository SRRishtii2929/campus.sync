import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/image.png" alt="Campus Sync" className="w-10 h-10 rounded-xl object-cover" />
              <span className="text-xl font-bold text-white">Campus Sync</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Simplifying college life through smart scheduling, clash detection, and seamless communication.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/dashboard" className="hover:text-teal-400 transition-colors">Dashboard</Link></li>
              <li><Link to="/timetable" className="hover:text-teal-400 transition-colors">Timetable</Link></li>
              <li><Link to="/events" className="hover:text-teal-400 transition-colors">Events</Link></li>
              <li><Link to="/notices" className="hover:text-teal-400 transition-colors">College Notices</Link></li>
              <li><Link to="/announcements" className="hover:text-teal-400 transition-colors">Society Announcements</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">About</h3>
            <p className="text-sm text-slate-400">
              A student-focused platform built by four first-year MAC students to simplify campus life by bringing important college and society updates together in one place.
            </p>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Campus Sync. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
