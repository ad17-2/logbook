import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocationInput } from '../components/form/location-input';

vi.mock('../api/locations', () => ({
  searchLocations: vi.fn(),
}));

describe('LocationInput', () => {
  const defaultProps = {
    label: 'Test Location',
    placeholder: 'Enter location',
    value: '',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders label and input', () => {
    render(<LocationInput {...defaultProps} />);
    expect(screen.getByText('Test Location')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter location')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<LocationInput {...defaultProps} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('Enter location'), {
      target: { value: 'San' },
    });

    expect(onChange).toHaveBeenCalledWith('San');
  });

  it('shows error message when provided', () => {
    render(<LocationInput {...defaultProps} error="Required field" />);
    expect(screen.getByText(/Required field/)).toBeInTheDocument();
  });

  it('shows suggestions when API returns results', async () => {
    const { searchLocations } = await import('../api/locations');
    vi.mocked(searchLocations).mockResolvedValue([
      { name: 'San Francisco, CA', lat: 37.77, lng: -122.42 },
      { name: 'San Jose, CA', lat: 37.34, lng: -121.89 },
    ]);

    const onChange = vi.fn();
    const { rerender } = render(
      <LocationInput {...defaultProps} value="San" onChange={onChange} />,
    );
    fireEvent.focus(screen.getByPlaceholderText('Enter location'));
    rerender(
      <LocationInput {...defaultProps} value="San Fra" onChange={onChange} />,
    );

    await waitFor(() => {
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
      expect(screen.getByText('San Jose, CA')).toBeInTheDocument();
    });
  });

  it('selects suggestion on click', async () => {
    const { searchLocations } = await import('../api/locations');
    vi.mocked(searchLocations).mockResolvedValue([
      { name: 'San Francisco, CA', lat: 37.77, lng: -122.42 },
    ]);

    const onChange = vi.fn();
    const { rerender } = render(
      <LocationInput {...defaultProps} value="San" onChange={onChange} />,
    );
    fireEvent.focus(screen.getByPlaceholderText('Enter location'));
    rerender(
      <LocationInput {...defaultProps} value="San Fra" onChange={onChange} />,
    );

    await waitFor(() => {
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText('San Francisco, CA'));
    expect(onChange).toHaveBeenCalledWith('San Francisco, CA');
  });

  it('handles keyboard navigation', async () => {
    const { searchLocations } = await import('../api/locations');
    vi.mocked(searchLocations).mockResolvedValue([
      { name: 'San Francisco, CA', lat: 37.77, lng: -122.42 },
      { name: 'San Jose, CA', lat: 37.34, lng: -121.89 },
    ]);

    const onChange = vi.fn();
    const { rerender } = render(
      <LocationInput {...defaultProps} value="San" onChange={onChange} />,
    );
    fireEvent.focus(screen.getByPlaceholderText('Enter location'));
    rerender(
      <LocationInput {...defaultProps} value="San Fra" onChange={onChange} />,
    );

    await waitFor(() => {
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter location');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('San Francisco, CA');
  });

  it('closes dropdown on Escape', async () => {
    const { searchLocations } = await import('../api/locations');
    vi.mocked(searchLocations).mockResolvedValue([
      { name: 'San Francisco, CA', lat: 37.77, lng: -122.42 },
    ]);

    const { rerender } = render(
      <LocationInput {...defaultProps} value="San" />,
    );
    fireEvent.focus(screen.getByPlaceholderText('Enter location'));
    rerender(<LocationInput {...defaultProps} value="San Fra" />);

    await waitFor(() => {
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByPlaceholderText('Enter location'), {
      key: 'Escape',
    });

    await waitFor(() => {
      expect(screen.queryByText('San Francisco, CA')).not.toBeInTheDocument();
    });
  });

  it('calls onBlur when input loses focus', () => {
    const onBlur = vi.fn();
    render(<LocationInput {...defaultProps} onBlur={onBlur} />);

    fireEvent.blur(screen.getByPlaceholderText('Enter location'));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('keeps suggestions closed when the value changes without focus', async () => {
    const { searchLocations } = await import('../api/locations');
    vi.mocked(searchLocations).mockResolvedValue([
      { name: 'San Francisco, CA', lat: 37.77, lng: -122.42 },
    ]);

    const { rerender } = render(<LocationInput {...defaultProps} value="San" />);
    rerender(<LocationInput {...defaultProps} value="San Fra" />);

    await waitFor(() => expect(searchLocations).toHaveBeenCalledWith('San Fra'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
