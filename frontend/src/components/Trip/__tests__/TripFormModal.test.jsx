import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/helpers';
import TripFormModal from '../TripFormModal';

// Mock stores
vi.mock('../../../stores/useTripStore', () => {
  const fn = vi.fn(() => ({
    createTrip: vi.fn(),
    updateTrip: vi.fn(),
    isLoading: false,
  }));
  fn.getState = vi.fn(() => ({}));
  return { default: fn };
});

// Mock LocationAutocomplete
vi.mock('../../Location/LocationAutocomplete', () => ({
  default: ({ placeholder }) => <input placeholder={placeholder} />,
}));

// Mock LocationMapPreview
vi.mock('../../Location/LocationMapPreview', () => ({
  default: () => null,
}));

// Mock DateRangePicker to render labeled inputs
vi.mock('../../common/DateRangePicker', () => ({
  default: ({ startLabel, endLabel }) => (
    <div>
      <label>{startLabel}</label>
      <label>{endLabel}</label>
    </div>
  ),
}));

describe('TripFormModal field order', () => {
  it('renders fields in the correct order: Name, Dates, Location, Budget, Tags, Description, Cover Image, Origin, Return', () => {
    renderWithProviders(
      <TripFormModal isOpen={true} onClose={vi.fn()} trip={null} onSuccess={vi.fn()} />
    );

    const expectedOrder = [
      'trips.tripName',
      'trips.startDate',
      'trips.destination',
      'trips.budgetField',
      'trips.tripTags',
      'common.description',
      'trips.coverImage',
      'trips.departurePoint',
      'trips.returnPoint',
    ];

    // Get all text content from the rendered form
    const body = document.body.textContent;

    // Verify each label appears after the previous one
    let lastIndex = -1;
    for (const key of expectedOrder) {
      const idx = body.indexOf(key, lastIndex + 1);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });
});
