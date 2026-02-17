import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/helpers';
import GlobalTripView from '../GlobalTripView';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}));

// Mock all stores
vi.mock('../../stores/useTripStore', () => {
  const fn = vi.fn(() => ({
    tripsWithDestinations: [],
    fetchTripsSummary: vi.fn(),
    isLoading: false,
    searchQuery: '',
    statusFilter: 'all',
    sortBy: 'default',
    showCompleted: true,
    setSearchQuery: vi.fn(),
    setStatusFilter: vi.fn(),
    setSortBy: vi.fn(),
    setShowCompleted: vi.fn(),
    clearFilters: vi.fn(),
    getFilteredTrips: () => [],
    getActiveFiltersCount: () => 0,
  }));
  fn.getState = vi.fn(() => ({ updateTrip: vi.fn() }));
  return { default: fn };
});

vi.mock('../../stores/useAuthStore', () => {
  const fn = vi.fn(() => ({ isAuthenticated: false }));
  fn.getState = vi.fn(() => ({}));
  return { default: fn };
});

vi.mock('../../stores/useCollaborationStore', () => {
  const fn = vi.fn(() => ({ fetchPendingInvitations: vi.fn() }));
  fn.getState = vi.fn(() => ({}));
  return { default: fn };
});

// Mock map components
vi.mock('../../components/Map/MacroMap', () => ({ default: () => <div data-testid="macro-map" /> }));
vi.mock('../../components/Map/MapPlaceholder', () => ({ default: () => <div data-testid="map-placeholder" /> }));
vi.mock('../../components/Layout/Breadcrumbs', () => ({ default: () => <nav>breadcrumbs</nav> }));
vi.mock('../../components/Trip', () => ({
  DeleteTripDialog: () => null,
  UndoToast: () => null,
  TripCard: () => null,
  TripSearchFilter: () => null,
}));
vi.mock('../../components/Trip/TripCardSkeleton', () => ({ default: () => null }));
vi.mock('../../components/UI/EmptyState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));
vi.mock('../../components/Collaboration/PendingInvitations', () => ({
  default: () => null,
}));

describe('GlobalTripView', () => {
  it('renders i18n key for page title', () => {
    renderWithProviders(<GlobalTripView />);
    expect(screen.getByText('globalTripView.title')).toBeInTheDocument();
  });

  it('renders i18n key for "New Trip" button', () => {
    renderWithProviders(<GlobalTripView />);
    expect(screen.getByText('globalTripView.newTrip')).toBeInTheDocument();
  });

  it('renders i18n key for empty state', () => {
    renderWithProviders(<GlobalTripView />);
    expect(screen.getByText('globalTripView.emptyTitle')).toBeInTheDocument();
  });
});
