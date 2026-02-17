import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TripCard from '../TripCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe('TripCard', () => {
  const baseTripProps = {
    trip: {
      id: 1,
      name: 'Test Trip',
      location: 'Paris',
      status: 'planning',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
      cover_image: 'https://example.com/image.jpg',
    },
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onStatusChange: vi.fn(),
    onShare: vi.fn(),
    onExport: vi.fn(),
  };

  it('renders cover image with loading="lazy"', () => {
    render(
      <MemoryRouter>
        <TripCard {...baseTripProps} />
      </MemoryRouter>
    );

    const img = screen.getByAltText('Test Trip');
    expect(img).toHaveAttribute('loading', 'lazy');
  });
});
