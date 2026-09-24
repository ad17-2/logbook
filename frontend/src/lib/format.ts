export function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function stopTypeName(type: string): string {
  const names: Record<string, string> = {
    pickup: 'Pickup',
    dropoff: 'Dropoff',
    rest_break: '30-Min Break',
    ten_hr_rest: '10-Hour Rest',
    fuel: 'Fuel Stop',
  };
  return names[type] || type;
}

export function currentHourLocal(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
}
