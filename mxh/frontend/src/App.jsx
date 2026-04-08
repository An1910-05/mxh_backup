import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { BlobSvgFilter } from './components/BlobButton';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import PostDetailPage from './pages/PostDetailPage';
import SearchPage from './pages/SearchPage';
import FriendsPage from './pages/FriendsPage';
import ChatPage from './pages/ChatPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import GamesPage from './pages/GamesPage';
import TiuXaiAdminPage from './pages/TiuXaiAdminPage';
import TiuXaiModal from './components/TiuXaiModal';
import PaymentResultPage from './pages/PaymentResultPage';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import FloatingChatWindow from './components/chat/FloatingChatWindow';
import { useChat } from './contexts/ChatContext';
import useIsMobile from './mobile/hooks/useIsMobile';
import MobileLayout from './mobile/MobileLayout';

const THEME_STORAGE_KEY = 'mxh-theme-mode';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

function FloatingChats() {
  const { openChats, closeChat, toggleMinimizeChat } = useChat();
  return (
    <>
      {openChats.map((conv, i) => (
        <FloatingChatWindow
          key={conv.id}
          conversation={conv}
          index={i}
          minimized={conv.minimized}
          onClose={() => closeChat(conv.id)}
          onMinimize={() => toggleMinimizeChat(conv.id)}
        />
      ))}
    </>
  );
}

function AppShell({ children }) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const isAuthRoute = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname);
  const [themeMode, setThemeMode] = useState(getInitialTheme);

  useEffect(() => {
    document.body.classList.toggle('is-mobile', isMobile);
    return () => document.body.classList.remove('is-mobile');
  }, [isMobile]);

  useEffect(() => {
    const isDark = themeMode === 'dark';
    document.body.classList.toggle('theme-dark', isDark);
    document.body.classList.toggle('theme-light', !isDark);
    document.body.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);

    return () => {
      document.body.classList.remove('theme-dark', 'theme-light');
      delete document.body.dataset.theme;
      document.documentElement.style.colorScheme = '';
    };
  }, [themeMode]);

  if (isAuthRoute) return <>{children}</>;
  if (isMobile) return <MobileLayout>{children}</MobileLayout>;
  return (
    <>
      <Navbar themeMode={themeMode} onThemeChange={setThemeMode} />
      <div className="desktop-layout">
        <LeftSidebar />
        <div className="desktop-content">{children}</div>
        <RightSidebar />
      </div>
      <FloatingChats />
    </>
  );
}

function TiuXaiGlobalModal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('open-tiu-xai', h);
    return () => window.removeEventListener('open-tiu-xai', h);
  }, []);
  return <TiuXaiModal open={open} onClose={() => setOpen(false)} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          <BlobSvgFilter />
          <TiuXaiGlobalModal />
          <AppShell>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
              <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/admin/tiu-xai" element={<ProtectedRoute><TiuXaiAdminPage /></ProtectedRoute>} />
              <Route path="/payment/result" element={<ProtectedRoute><PaymentResultPage /></ProtectedRoute>} />
              <Route path="/post/:postId" element={<ProtectedRoute><PostDetailPage /></ProtectedRoute>} />
              <Route path="/:customUrl" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            </Routes>
          </AppShell>
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
