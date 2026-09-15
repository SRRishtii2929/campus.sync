import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { GraduationCap, Mail, Lock, User, Loader2, AlertCircle, Building, Users } from 'lucide-react';
import type { UserRole, StudentType } from '@/lib/supabase';

const BRANCHES = [
  'CSE', 'CSAI', 'CSE-CS', 'MAC', 'MAE', 'RAIE', 'ECE', 'ECE-AI',
  'DMAM', 'IT', 'AIML', 'BSc-MSc Physics', 'BSc-MSc Maths',
  'BSc-MSc Chemistry', 'BBA',
] as const;

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'] as const;
const SECTIONS = ['1', '2', '3'] as const;

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [studentType, setStudentType] = useState<StudentType>('regular');
  const [societyName, setSocietyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (role === 'student' && (!branch || !year || !section)) {
      setError('Please select your Branch, Year, and Section.');
      return;
    }
    if (role === 'society_admin' && !societyName.trim()) {
      setError('Please enter your Society Name.');
      return;
    }

    if (role === 'society_admin') {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('society_name', societyName.trim())
        .maybeSingle();
      if (existing) {
        setError('This society is already registered.');
        return;
      }
    }

    setLoading(true);
    const effectiveFullName = role === 'society_admin' ? societyName.trim() : fullName;
    const effectiveDepartment = role === 'society_admin' ? 'Society' : (department || 'General');
    const { error } = await signUp(
      email, password, effectiveFullName, role, effectiveDepartment,
      role === 'student' ? branch : undefined,
      role === 'student' ? year : undefined,
      role === 'student' ? section : undefined,
      role === 'student' ? studentType : undefined,
      role === 'society_admin' ? societyName.trim() : undefined,
    );
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 to-teal-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-md">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Create Account</h1>
            <p className="text-sm text-slate-500 mt-1">Join Campus Sync today</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {role !== 'society_admin' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}
            {role === 'society_admin' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Society Name</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={societyName}
                    onChange={(e) => setSocietyName(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                    placeholder="Coding Society"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">This name uniquely identifies your society. It cannot be changed later.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                  placeholder="you@college.edu"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                  placeholder="At least 6 characters"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Minimum 6 characters. Choose any password you like.</p>
            </div>
            {role !== 'society_admin' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Department</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                    placeholder="Mathematics and Computing"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'student', label: 'Student' },
                  { value: 'society_admin', label: 'Society Admin' },
                  { value: 'college_admin', label: 'College Admin' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                      role === opt.value
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {role === 'student' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Student Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'regular', label: 'Regular Student' },
                      { value: 'cr', label: 'CR (Class Representative)' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStudentType(opt.value)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                          studentType === opt.value
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Branch *</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all bg-white"
                  >
                    <option value="">Select your branch</option>
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Year *</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all bg-white"
                    >
                      <option value="">Select year</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Section *</label>
                    <select
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all bg-white"
                    >
                      <option value="">Select section</option>
                      {SECTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
