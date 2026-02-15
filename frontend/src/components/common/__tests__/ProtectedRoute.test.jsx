import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';
import useAuthStore from '../../../stores/useAuthStore';

vi.mock('../../../stores/useAuthStore');

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders children when authenticated', () => {
    useAuthStore.mockImplementation((selector) => {
      const state = { isAuthenticated: true, isLoading: false };
      return selector(state);
    });

    render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeDefined();
  });

  it('shows spinner when loading', () => {
    useAuthStore.mockImplementation((selector) => {
      const state = { isAuthenticated: false, isLoading: true };
      return selector(state);
    });

    render(
      <MemoryRouter>
        <ProtectedRoute><div>Content</div></ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('auth-loading')).toBeDefined();
  });

  it('redirects to login when unauthenticated', () => {
    useAuthStore.mockImplementation((selector) => {
      const state = { isAuthenticated: false, isLoading: false };
      return selector(state);
    });

    render(
      <MemoryRouter initialEntries={['/trips']}>
        <ProtectedRoute><div>Content</div></ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Content')).toBeNull();
  });
});
