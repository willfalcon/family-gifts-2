import { Event } from '@convex/types';

function parseISODate(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(value: string) {
  const date = parseISODate(value);
  return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : value;
}

function formatTime(value: string) {
  const [h, m] = value.split(':').map(Number);
  if (h === undefined || m === undefined) return value;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatWhen(event: Event) {
  const isRange = !!event.date && !!event.endDate && event.endDate !== event.date;

  // No date at all - fall back to showing just the time(s), if any were set.
  if (!event.date) {
    if (event.startTime && event.endTime) return `${formatTime(event.startTime)}–${formatTime(event.endTime)}`;
    if (event.startTime) return formatTime(event.startTime);
    if (event.endTime) return `Until ${formatTime(event.endTime)}`;
    return 'No date set';
  }

  if (isRange) {
    // Each end of a multi-day range gets its own time, if set, rather than
    // dropping times just because the event spans more than one day.
    const start = event.startTime ? `${formatDate(event.date)}, ${formatTime(event.startTime)}` : formatDate(event.date);
    const end = event.endTime ? `${formatDate(event.endDate!)}, ${formatTime(event.endTime)}` : formatDate(event.endDate!);
    return `${start} – ${end}`;
  }

  const date = formatDate(event.date);
  if (event.startTime && event.endTime) return `${date}, ${formatTime(event.startTime)}–${formatTime(event.endTime)}`;
  if (event.startTime) return `${date}, ${formatTime(event.startTime)}`;
  if (event.endTime) return `${date}, until ${formatTime(event.endTime)}`;
  return date;
}
