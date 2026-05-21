import { useEffect, useState } from 'react';
import { Agentation } from 'agentation';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { CallProvider } from './contexts/CallContext';
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
import WalletPage from './pages/WalletPage';
import GamesPage from './pages/GamesPage';
import CaroPage from './pages/CaroPage';
import ShopPage from './pages/ShopPage';
import ShopRegisterPage from './pages/ShopRegisterPage';
import ShopDashboardPage from './pages/ShopDashboardPage';
import ShopProductDetailPage from './pages/ShopProductDetailPage';
import ShopCartPage from './pages/ShopCartPage';
import AdminShopApplications from './pages/admin/AdminShopApplications';
import PaymentResultPage from './pages/PaymentResultPage';
import TaiXiuFloatingWidget from './components/TaiXiuFloatingWidget';
import LeftSidebar from './components/LeftSidebar';
import FloatingChatManager from './components/FloatingChatWindow';
import RightSidebar from './components/RightSidebar';
import IncomingCallToast from './components/IncomingCallToast';
import CallWindow from './components/CallWindow';
import useIsMobile from './mobile/hooks/useIsMobile';
import MobileLayout from './mobile/MobileLayout';
import AdminRoute from './pages/admin/AdminRoute';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPosts from './pages/admin/AdminPosts';
import AdminTransactions from './pages/admin/AdminTransactions';

const THEME_STORAGE_KEY = 'mxh-theme-mode';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
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
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <ChatProvider>
          <CallProvider>
          <Agentation />
          <BlobSvgFilter />
          <TaiXiuFloatingWidget />
          <FloatingChatManager />
          <IncomingCallToast />
          <CallWindow />
          <Routes>
            {/* Admin — own layout, no AppShell */}
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="posts" element={<AdminPosts />} />
              <Route path="transactions" element={<AdminTransactions />} />
              <Route path="shop-applications" element={<AdminShopApplications />} />
            </Route>

            {/* Main app — wrapped in AppShell */}
            <Route path="*" element={
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
                  <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
                  <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
                  <Route path="/shop/register" element={<ProtectedRoute><ShopRegisterPage /></ProtectedRoute>} />
                  <Route path="/shop/dashboard" element={<ProtectedRoute><ShopDashboardPage /></ProtectedRoute>} />
                  <Route path="/shop/cart" element={<ProtectedRoute><ShopCartPage /></ProtectedRoute>} />
                  <Route path="/shop/product/:productId" element={<ProtectedRoute><ShopProductDetailPage /></ProtectedRoute>} />
                  <Route path="/games" element={<ProtectedRoute><GamesPage /></ProtectedRoute>} />
                  <Route path="/games/caro" element={<ProtectedRoute><CaroPage /></ProtectedRoute>} />
                  <Route path="/games/caro/:roomId" element={<ProtectedRoute><CaroPage /></ProtectedRoute>} />
                  <Route path="/payment/result" element={<ProtectedRoute><PaymentResultPage /></ProtectedRoute>} />
                  <Route path="/post/:postId" element={<ProtectedRoute><PostDetailPage /></ProtectedRoute>} />
                  <Route path="/:customUrl" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                </Routes>
              </AppShell>
            } />
          </Routes>
          </CallProvider>
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
