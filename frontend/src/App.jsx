import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/layout/Navbar';
import ScrollToTop from './components/layout/ScrollToTop';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AIChatWidget from './components/ai/AIChatWidget';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Home = lazy(() => import('./pages/Tenant/Home'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const AssistantPage = lazy(() => import('./pages/AI/AssistantPage'));

const RoomsPage = lazy(() => import('./pages/Tenant/RoomsPage'));
const RoomDetail = lazy(() => import('./pages/Tenant/RoomDetail'));
const FavoritesPage = lazy(() => import('./pages/Tenant/FavoritesPage'));
const AppointmentsPage = lazy(() => import('./pages/Tenant/AppointmentsPage'));
const DepositsPage = lazy(() => import('./pages/Tenant/DepositsPage'));
const MyRequestsPage = lazy(() => import('./pages/Tenant/MyRequestsPage'));

const ChatPage = lazy(() => import('./pages/Chat/ChatPage'));
const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'));
const LandlordDashboard = lazy(() => import('./pages/Landlord/Dashboard'));
const PostRoom = lazy(() => import('./pages/Landlord/PostRoom'));
const MyRooms = lazy(() => import('./pages/Landlord/MyRooms'));
const EditRoom = lazy(() => import('./pages/Landlord/EditRoom'));
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'));
const LandlordProfile = lazy(() => import('./pages/Landlord/LandlordProfile'));
const LandlordRequests = lazy(() => import('./pages/Landlord/RoommateRequests'));

const LoadingScreen = () => (
  <div className="loading-screen">
    <div className="spinner" />
    <p>Đang tải RoommieMatch...</p>
  </div>
);

const App = () => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <ScrollToTop />
      <Navbar />
      <AIChatWidget />
      <main className="page-content">
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/rooms/:id" element={<RoomDetail />} />
            <Route path="/landlords/:id" element={<LandlordProfile />} />
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to={getDefaultPath(user?.role)} replace /> : <Login />}
            />
            <Route
              path="/register"
              element={isAuthenticated ? <Navigate to={getDefaultPath(user?.role)} replace /> : <Register />}
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={['tenant', 'landlord', 'admin']}>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute allowedRoles={['tenant', 'landlord', 'admin']}>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:convId"
              element={
                <ProtectedRoute allowedRoles={['tenant', 'landlord', 'admin']}>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assistant"
              element={<AssistantPage />}
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute allowedRoles={['tenant', 'landlord']}>
                  <AppointmentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/deposits"
              element={
                <ProtectedRoute allowedRoles={['tenant', 'landlord', 'admin']}>
                  <DepositsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/favorites"
              element={
                <ProtectedRoute allowedRoles={['tenant']}>
                  <FavoritesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-requests"
              element={
                <ProtectedRoute allowedRoles={['tenant']}>
                  <MyRequestsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/landlord/dashboard"
              element={
                <ProtectedRoute allowedRoles={['landlord']}>
                  <LandlordDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/landlord/post"
              element={
                <ProtectedRoute allowedRoles={['landlord']}>
                  <PostRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/landlord/my-rooms"
              element={
                <ProtectedRoute allowedRoles={['landlord']}>
                  <MyRooms />
                </ProtectedRoute>
              }
            />
            <Route
              path="/landlord/edit/:id"
              element={
                <ProtectedRoute allowedRoles={['landlord']}>
                  <EditRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/landlord/requests"
              element={
                <ProtectedRoute allowedRoles={['landlord']}>
                  <LandlordRequests />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/notifications"
              element={
                <ProtectedRoute allowedRoles={['tenant', 'landlord', 'admin']}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
};

const getDefaultPath = (role) => {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'landlord') return '/landlord/dashboard';
  return '/';
};

export default App;
