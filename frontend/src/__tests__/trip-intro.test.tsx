import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TripProvider } from '../context/trip-context';
import { TripForm } from '../components/form/trip-form';
import { TripIntro } from '../components/results/trip-intro';

vi.mock('../api/trips', () => ({
  planTrip: vi.fn(),
}));

vi.mock('../api/locations', () => ({
  searchLocations: vi.fn().mockResolvedValue([]),
}));

describe('TripIntro', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fills the trip form when load example is clicked', () => {
    render(
      <TripProvider>
        <TripForm />
        <TripIntro />
      </TripProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /load example/i }));

    expect(screen.getByPlaceholderText('e.g. san francisco, ca')).toHaveValue('San Francisco, CA');
    expect(screen.getByPlaceholderText('e.g. sacramento, ca')).toHaveValue('Sacramento, CA');
    expect(screen.getByPlaceholderText('e.g. new york, ny')).toHaveValue('New York, NY');
    expect(screen.getByLabelText('cycle used, hours')).toHaveValue(10);
  });

  it('resets edited fields when load example is clicked again', () => {
    render(
      <TripProvider>
        <TripForm />
        <TripIntro />
      </TripProvider>,
    );
    const loadExample = screen.getByRole('button', { name: /load example/i });
    const current = screen.getByPlaceholderText('e.g. san francisco, ca');

    fireEvent.click(loadExample);
    fireEvent.change(current, { target: { value: 'Denver, CO' } });
    fireEvent.click(loadExample);

    expect(current).toHaveValue('San Francisco, CA');
  });
});
