import { Link } from 'react-router-dom';
import { GraduationCap, Calendar, Bell, Users, AlertTriangle, Megaphone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Landing() {
  const { session } = useAuth();

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
              Smart Campus Management
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6">
              Welcome to <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">Campus Sync</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
              Your all-in-one college companion. Manage your timetable, track events, receive notices, and never miss a clash again.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {session ? (
                <Link to="/dashboard" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-teal-500 text-white font-semibold hover:bg-teal-400 transition-all shadow-lg hover:shadow-teal-500/30">
                  Go to Dashboard <ArrowRight className="w-5 h-5" />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-teal-500 text-white font-semibold hover:bg-teal-400 transition-all shadow-lg hover:shadow-teal-500/30">
                    Get Started <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link to="/login" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-all border border-white/20">
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">Everything you need for campus life</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">One platform to manage your classes, events, notices, and society activities.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Calendar, title: 'Smart Timetable', desc: 'View and manage your weekly class schedule with an intuitive interface.', color: 'bg-blue-500' },
              { icon: AlertTriangle, title: 'Clash Detection', desc: 'Automatic detection of overlapping classes and events with clear warnings.', color: 'bg-red-500' },
              { icon: Bell, title: 'College Notices', desc: 'Stay updated with official notices from college administration.', color: 'bg-amber-500' },
              { icon: Users, title: 'College Events', desc: 'Browse and track upcoming college events and activities.', color: 'bg-teal-500' },
              { icon: Megaphone, title: 'Society Announcements', desc: 'Get the latest announcements from student societies and clubs.', color: 'bg-purple-500' },
              { icon: GraduationCap, title: 'Role-Based Access', desc: 'Tailored dashboards for students, society admins, and college admins.', color: 'bg-indigo-500' },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="group p-6 rounded-2xl border border-slate-200 hover:border-teal-300 hover:shadow-lg transition-all bg-white">
                  <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-slate-800 mb-8">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Create Account', desc: 'Register as a student, society admin, or college admin.' },
              { step: '2', title: 'Set Your Schedule', desc: 'Add your classes and browse events and notices.' },
              { step: '3', title: 'Stay In Sync', desc: 'Get instant clash alerts and never miss what matters.' },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="w-16 h-16 rounded-full bg-teal-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4 shadow-lg">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-teal-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to simplify your campus life?</h2>
          <p className="text-teal-100 mb-8">Join Campus Sync today and never miss a beat.</p>
          {!session && (
            <Link to="/register" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-teal-700 font-semibold hover:bg-teal-50 transition-all shadow-lg">
              Create Your Account <ArrowRight className="w-5 h-5" />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
