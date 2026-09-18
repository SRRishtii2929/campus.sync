import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/lib/supabase';

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Block pending/rejected college_admins from accessing admin functionality
  if (profile?.role === 'college_admin' && profile.approval_status !== 'approved') {
    if (roles?.includes('college_admin') || roles?.includes('primary_admin')) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
