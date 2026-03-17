import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Job from './pages/Job';
import History from './pages/History';
import Settings from './pages/Settings';
import AgentStagePage from './pages/AgentStagePage';
import ErrorBoundary from './components/ErrorBoundary'

const HomeWithLayout = () => <Layout><Home /></Layout>
const JobWithLayout = () => <Layout><Job /></Layout>
const HistoryWithLayout = () => <Layout><History /></Layout>
const SettingsWithLayout = () => <Layout><Settings /></Layout>

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return (
    <Routes>
      <Route path="/" element={user ? <HomeWithLayout /> : <Landing />} />
      <Route path="/landing" element={user ? <Navigate to="/" replace /> : <Landing />} />
      <Route path="/app" element={user ? <HomeWithLayout /> : <Navigate to="/" replace />} />
      <Route path="/job/:id" element={user ? <JobWithLayout /> : <Navigate to="/" replace />} />
      <Route path="/job/:jobId/agent/:agentKey" element={user ? <AgentStagePage /> : <Navigate to="/" replace />} />
      <Route path="/history" element={user ? <HistoryWithLayout /> : <Navigate to="/" replace />} />
      <Route path="/settings" element={user ? <SettingsWithLayout /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
