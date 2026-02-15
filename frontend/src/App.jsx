import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MapboxProvider } from './contexts/MapboxContext';
import { ItineraryUIProvider } from './contexts/ItineraryUIContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ToastProvider } from './components/common/Toast';
import Layout from './components/Layout/Layout';
import GlobalTripView from './pages/GlobalTripView';
import DetailView from './pages/DetailView';
import SettingsPage from './pages/SettingsPage';
import AISettingsPage from './pages/AISettingsPage';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ProtectedRoute from './components/common/ProtectedRoute';
import useAuthStore from './stores/useAuthStore';

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';

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
          <ItineraryUIProvider>
            <MapboxProvider>
              <Router>
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
              </Router>
            </MapboxProvider>
          </ItineraryUIProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;