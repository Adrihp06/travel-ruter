import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
  withTranslation: () => (Component) => Component,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Mock all page components as lazy-loaded modules
vi.mock('../pages/GlobalTripView', () => ({ default: () => <div data-testid="global-trip-view">GlobalTripView</div> }));
vi.mock('../pages/DetailView', () => ({ default: () => <div data-testid="detail-view">DetailView</div> }));
vi.mock('../pages/SettingsPage', () => ({ default: () => <div data-testid="settings-page">SettingsPage</div> }));
vi.mock('../pages/AISettingsPage', () => ({ default: () => <div data-testid="ai-settings-page">AISettingsPage</div> }));
vi.mock('../pages/LoginPage', () => ({ default: () => <div data-testid="login-page">LoginPage</div> }));
vi.mock('../pages/AuthCallbackPage', () => ({ default: () => <div data-testid="auth-callback-page">AuthCallbackPage</div> }));
vi.mock('../components/Layout/Layout', () => {
  const { Outlet } = require('react-router-dom');
  return { default: () => <div data-testid="layout"><Outlet /></div> };
});
vi.mock('../components/common/ProtectedRoute', () => ({ default: ({ children }) => children }));
vi.mock('../contexts/MapboxContext', () => ({ MapboxProvider: ({ children }) => children }));
vi.mock('../contexts/ThemeContext', () => ({ ThemeProvider: ({ children }) => children }));
vi.mock('../stores/useAuthStore', () => {
  const fn = vi.fn(() => ({}));
  fn.getState = vi.fn(() => ({ initialize: vi.fn() }));
  return { default: fn };
});

describe('App', () => {
  it('renders without crashing with Suspense', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });
});
