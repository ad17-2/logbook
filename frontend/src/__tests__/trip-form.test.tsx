import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TripProvider } from '../context/trip-context';
import { TripForm } from '../components/form/trip-form';

vi.mock('../api/trips', () => ({
  planTrip: vi.fn(),
}));

vi.mock('../api/locations', () => ({
  searchLocations: vi.fn().mockResolvedValue([]),
}));

function renderForm(): ReturnType<typeof render> {
  return render(
    <TripProvider>
      <TripForm />
    </TripProvider>,
  );
}

describe('TripForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all form fields', () => {
    renderForm();
    expect(screen.getByText('01 current location')).toBeInTheDocument();
    expect(screen.getByText('02 pickup')).toBeInTheDocument();
    expect(screen.getByText('03 dropoff')).toBeInTheDocument();
    expect(screen.getByText('04 cycle used')).toBeInTheDocument();
  });

  it('submit button is disabled when form is incomplete', () => {
    renderForm();
    const button = screen.getByRole('button', { name: /run plan/i });
    expect(button).toBeDisabled();
  });

  it('submit button enables when all fields are filled', async () => {
    renderForm();

    const inputs = screen.getAllByRole('combobox');
    fireEvent.change(inputs[0], { target: { value: 'San Francisco, CA' } });
    fireEvent.change(inputs[1], { target: { value: 'Sacramento, CA' } });
    fireEvent.change(inputs[2], { target: { value: 'New York, NY' } });

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /run plan/i });
      expect(button).not.toBeDisabled();
    });
  });

  it('shows validation error when dropoff matches pickup', async () => {
    renderForm();

    const inputs = screen.getAllByRole('combobox');
    fireEvent.change(inputs[0], { target: { value: 'San Francisco, CA' } });
    fireEvent.change(inputs[1], { target: { value: 'Same Place' } });
    fireEvent.change(inputs[2], { target: { value: 'Same Place' } });
    fireEvent.blur(inputs[2]);

    await waitFor(() => {
      expect(screen.getByText(/dropoff must be different from pickup/)).toBeInTheDocument();
    });
  });

  it('shows warning when cycle used exceeds 60', () => {
    renderForm();

    const rangeInput = screen.getByRole('slider');
    fireEvent.change(rangeInput, { target: { value: '65' } });

    expect(screen.getByText('limited driving time available')).toBeInTheDocument();
  });

  it('calls planTrip on valid submission', async () => {
    const { planTrip } = await import('../api/trips');
    const mockPlanTrip = vi.mocked(planTrip);
    mockPlanTrip.mockResolvedValue({
      route: { totalDistanceMiles: 100, totalDurationHours: 2, polyline: [] },
      stops: [],
      dailyLogs: [],
    });

    renderForm();

    const inputs = screen.getAllByRole('combobox');
    fireEvent.change(inputs[0], { target: { value: 'San Francisco, CA' } });
    fireEvent.change(inputs[1], { target: { value: 'Sacramento, CA' } });
    fireEvent.change(inputs[2], { target: { value: 'New York, NY' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run plan/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /run plan/i }));

    await waitFor(() => {
      expect(mockPlanTrip).toHaveBeenCalledTimes(1);
    });
  });
});
