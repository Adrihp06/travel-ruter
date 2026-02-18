import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MapboxProvider } from './contexts/MapboxContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ToastProvider } from './components/common/Toast';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';
import useAuthStore from './stores/useAuthStore';
import ReportIssueButton from './components/Feedback/ReportIssueButton';

// Lazy-loaded page components for code splitting
const GlobalTripView = lazy(() => import('./pages/GlobalTripView'));
const DetailView = lazy(() => import('./pages/DetailView'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AISettingsPage = lazy(() => import('./pages/AISettingsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
    </div>
  );
}

function App() {
  useEffect(() => {
    if (AUTH_ENABLED) {
      useAuthStore.getState().initialize();
    }
  }, []);

  const layoutElement = AUTH_ENABLED
    ? <ProtectedRoute><Layout /></ProtectedRoute>
    : <Layout />;

  return (
    <ErrorBoundary message="The application encountered an unexpected error. Please refresh the page or try again.">
      <ThemeProvider>
        <ToastProvider position="bottom-right" maxToasts={5}>
          <MapboxProvider>
            <Router>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />
                  <Route path="/" element={layoutElement}>
                    <Route index element={<Navigate to="/trips" replace />} />
                    <Route path="trips" element={<GlobalTripView />} />
                    <Route path="trips/:id" element={<DetailView />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="ai-settings" element={<AISettingsPage />} />
                    <Route path="*" element={<div className="p-4">Page not found</div>} />
                  </Route>
                </Routes>
              </Suspense>
              <ReportIssueButton />
            </Router>
          </MapboxProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
