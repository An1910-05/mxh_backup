import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { BlobSvgFilter } from './components/BlobButton';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import PostDetailPage from './pages/PostDetailPage';
import SearchPage from './pages/SearchPage';
import FriendsPage from './pages/FriendsPage';
import ChatPage from './pages/ChatPage';
import NotificationsPage from './pages/NotificationsPage';
import useIsMobile from './mobile/hooks/useIsMobile';
import MobileLayout from './mobile/MobileLayout';

function AppShell({ children }) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';
  useEffect(() => {
    document.body.classList.toggle('is-mobile', isMobile);
    return () => document.body.classList.remove('is-mobile');
  }, [isMobile]);

  if (isAuthRoute) return <>{children}</>;
  if (isMobile) return <MobileLayout>{children}</MobileLayout>;
  return <><Navbar /><div>{children}</div></>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          <BlobSvgFilter />
          <AppShell>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
              <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="/post/:postId" element={<ProtectedRoute><PostDetailPage /></ProtectedRoute>} />
              <Route path="/:customUrl" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            </Routes>
          </AppShell>
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
