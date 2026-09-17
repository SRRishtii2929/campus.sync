import { GraduationCap, Target, Users, Calendar, Bell, AlertTriangle, Megaphone } from 'lucide-react';

export default function About() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 mb-6">
          <img src="/image.png" alt="Campus Sync" className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
        </div>
        <h1 className="text-4xl font-bold text-slate-800 mb-3">About Campus Sync</h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Your all-in-one college companion for managing schedules, events, notices, and society activities.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 shadow-sm mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Our Story</h2>
        <p className="text-lg text-slate-600 leading-relaxed">
          CampusSync was born from a simple first-year experience: important updates were scattered across WhatsApp groups, college notices, emails, and society messages. As four first-year MAC students, we wanted to build a simpler way to stay updated — without having to search through endless messages.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center mb-4">
            <Target className="w-6 h-6 text-teal-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Our Mission</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            To simplify college life through smart technology that keeps students informed and organized.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">For Everyone</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Students, society administrators, and college administrators each get tailored dashboards.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Smart Detection</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Automatic clash detection ensures you never miss a conflicting class or event.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-teal-900 rounded-2xl p-8 sm:p-12 text-center">
        <h2 className="text-2xl font-bold text-white mb-6">What Campus Sync Offers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Calendar, label: 'Smart Timetable' },
            { icon: AlertTriangle, label: 'Clash Detection' },
            { icon: Bell, label: 'College Notices' },
            { icon: Users, label: 'College Events' },
            { icon: Megaphone, label: 'Society Announcements' },
            { icon: Target, label: 'Role-Based Access' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-3 p-4 rounded-xl bg-white/10 border border-white/10">
                <Icon className="w-5 h-5 text-teal-300" />
                <span className="text-sm font-medium text-white">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
