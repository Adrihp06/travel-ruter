import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import GlobalTripView from './pages/GlobalTripView';
import DetailView from './pages/DetailView';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/trips" replace />} />
          <Route path="trips" element={<GlobalTripView />} />
          <Route path="trips/:id" element={<DetailView />} />
          <Route path="*" element={<div className="p-4">Page not found</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;