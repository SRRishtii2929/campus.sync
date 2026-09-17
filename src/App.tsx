import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Timetable from '@/pages/Timetable';
import Events from '@/pages/Events';
import Notices from '@/pages/Notices';
import Announcements from '@/pages/Announcements';
import About from '@/pages/About';
import AdminPanel from '@/pages/AdminPanel';
import SocietyPanel from '@/pages/SocietyPanel';

function AppContent() {
  const { loading } = useAuth();
  const [animationDone, setAnimationDone] = useState(false);

  const handleAnimationComplete = useCallback(() => setAnimationDone(true), []);

  if (loading && !animationDone) {
    return <LoadingScreen onComplete={handleAnimationComplete} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/about" element={<About />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/timetable" element={<ProtectedRoute roles={['student']}><Timetable /></ProtectedRoute>} />
          <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
          <Route path="/notices" element={<ProtectedRoute><Notices /></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['college_admin']}><AdminPanel /></ProtectedRoute>} />
          <Route path="/society-admin" element={<ProtectedRoute roles={['society_admin']}><SocietyPanel /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
