import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSmoothScroll } from './hooks/useSmoothScroll';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Job from './pages/Job';
import History from './pages/History';
import Settings from './pages/Settings';
import AgentStagePage from './pages/AgentStagePage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/landing" replace />;
  return children;
}

function App() {
  const { user, loading } = useAuth();
  useSmoothScroll();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — shown when not logged in */}
        <Route path="/landing" element={user ? <Navigate to="/" replace /> : <Landing />} />

        {/* Authenticated routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout><Home /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/job/:id" element={
          <ProtectedRoute>
            <Layout><Job /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/job/:jobId/agent/:agentKey" element={
          <ProtectedRoute>
            <AgentStagePage />
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute>
            <Layout><History /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Layout><Settings /></Layout>
          </ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={user ? "/" : "/landing"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
