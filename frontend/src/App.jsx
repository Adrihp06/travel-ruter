import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MapboxProvider } from './contexts/MapboxContext';
import { ItineraryUIProvider } from './contexts/ItineraryUIContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout/Layout';
import GlobalTripView from './pages/GlobalTripView';
import DetailView from './pages/DetailView';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <ThemeProvider>
      <ItineraryUIProvider>
        <MapboxProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/trips" replace />} />
              <Route path="trips" element={<GlobalTripView />} />
              <Route path="trips/:id" element={<DetailView />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<div className="p-4">Page not found</div>} />
            </Route>
          </Routes>
        </Router>
      </MapboxProvider>
      </ItineraryUIProvider>
    </ThemeProvider>
  );
}

export default App;