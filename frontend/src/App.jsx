import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import ErrorBoundary from './components/ErrorBoundary'

// Lazy-loaded pages for code splitting
const Landing = lazy(() => import('./pages/Landing'));
const Home = lazy(() => import('./pages/Home'));
const Job = lazy(() => import('./pages/Job'));
const History = lazy(() => import('./pages/History'));
const Settings = lazy(() => import('./pages/Settings'));
const AgentStagePage = lazy(() => import('./pages/AgentStagePage'));
const Admin = lazy(() => import('./pages/Admin'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
    <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
  </div>
);

const HomeWithLayout = () => <Layout><Suspense fallback={<PageLoader />}><Home /></Suspense></Layout>
const JobWithLayout = () => <Layout><Suspense fallback={<PageLoader />}><Job /></Suspense></Layout>
const HistoryWithLayout = () => <Layout><Suspense fallback={<PageLoader />}><History /></Suspense></Layout>
const SettingsWithLayout = () => <Layout><Suspense fallback={<PageLoader />}><Settings /></Suspense></Layout>

const AdminWithLayout = () => <Layout><Suspense fallback={<PageLoader />}><Admin /></Suspense></Layout>

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/app" element={user ? <HomeWithLayout /> : <Navigate to="/" replace />} />
        <Route path="/job/:id" element={user ? <JobWithLayout /> : <Navigate to="/" replace />} />
        <Route path="/job/:jobId/agent/:agentKey" element={user ? <AgentStagePage /> : <Navigate to="/" replace />} />
        <Route path="/history" element={user ? <HistoryWithLayout /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={user ? <SettingsWithLayout /> : <Navigate to="/" replace />} />
        <Route path="/admin" element={user ? <AdminWithLayout /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' },
          }}
        />
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
