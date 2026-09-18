import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { GraduationCap, Mail, User, Loader2, AlertCircle, Users, Clock } from 'lucide-react';
import type { UserRole, StudentType } from '@/lib/supabase';
import LoadingScreen from '@/components/LoadingScreen';
import PasswordInput from '@/components/PasswordInput';
import InterestSelector from '@/components/InterestSelector';

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
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [studentType, setStudentType] = useState<StudentType>('regular');
  const [societyName, setSocietyName] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{ role: UserRole } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (role === 'student' && !email.trim().toLowerCase().endsWith('@igdtuw.ac.in')) {
      setError('Please use your official IGDTUW email address.');
      return;
    }
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
    const effectiveDepartment = role === 'society_admin' ? 'Society' : 'General';
    const { error } = await signUp(
      email, password, effectiveFullName, role, effectiveDepartment,
      role === 'student' ? branch : undefined,
      role === 'student' ? year : undefined,
      role === 'student' ? section : undefined,
      role === 'student' ? studentType : undefined,
      role === 'society_admin' ? societyName.trim() : undefined,
      role === 'student' ? interests : undefined,
    );
    if (error) {
      setLoading(false);
      setError(error);
    } else {
      if (role === 'college_admin') {
        setLoading(false);
        setRegistrationResult({ role });
      } else {
        setShowLoadingScreen(true);
      }
    }
  };

  if (registrationResult) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 to-teal-50 dark:from-slate-900 dark:to-slate-950">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Registration Submitted</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Your CampusSync College Admin registration has been submitted and is awaiting approval from a Primary Administrator.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
              You will receive an email notification once your account is reviewed. You can close this page for now.
            </p>
            <Link to="/" className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (showLoadingScreen) {
    return <LoadingScreen onComplete={() => navigate('/dashboard')} appReady={true} />;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 to-teal-50 dark:from-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-md">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Create Account</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Join Campus Sync today</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {role !== 'society_admin' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all dark:bg-slate-900 dark:text-slate-200"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}
            {role === 'society_admin' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Society Name</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={societyName}
                    onChange={(e) => setSocietyName(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all dark:bg-slate-900 dark:text-slate-200"
                    placeholder="Coding Society"
                  />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">This name uniquely identifies your society. It cannot be changed later.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all dark:bg-slate-900 dark:text-slate-200"
                  placeholder={role === 'student' ? 'you@igdtuw.ac.in' : 'you@example.com'}
                />
              </div>
              {role === 'student' && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Use your official IGDTUW email address (ending in @igdtuw.ac.in).</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                required
                minLength={6}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                showHint
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role</label>
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
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-teal-400'
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Student Type *</label>
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
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-teal-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Branch *</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all bg-white dark:bg-slate-800"
                  >
                    <option value="">Select your branch</option>
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Year *</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all bg-white dark:bg-slate-800"
                    >
                      <option value="">Select year</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Section *</label>
                    <select
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all bg-white dark:bg-slate-800"
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
            {role === 'student' && (
              <InterestSelector
                selected={interests}
                onChange={setInterests}
                label="Interests"
                hint="Choose topics you're interested in to receive more relevant updates. You can change these later from your profile."
                optional
              />
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-600 dark:text-teal-400 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
