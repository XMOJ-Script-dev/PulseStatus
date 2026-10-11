import type { Maintenance } from '../types/status';

export function parseMaintenanceTimes(body: string | null): { startsAt: string; endsAt: string; timezone: string } | null {
  const text = body ?? '';
  const startsAt = text.match(/(?:^|\n)(?:###\s*)?Starts?\s+at\s*:?\s*\n?\s*(\S+)/i)?.[1];
  const endsAt = text.match(/(?:^|\n)(?:###\s*)?Ends?\s+at\s*:?\s*\n?\s*(\S+)/i)?.[1];
  const timezone = text.match(/(?:^|\n)(?:###\s*)?Timezone\s*:?\s*\n?\s*([A-Za-z0-9_./+-]+)/i)?.[1] ?? 'UTC';
  if (!startsAt || !endsAt) return null;
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || startDate >= endDate) return null;
  return { startsAt: startDate.toISOString(), endsAt: endDate.toISOString(), timezone };
}

export function maintenanceState(startsAt: string, endsAt: string, now = new Date()): Maintenance['state'] {
  const start = new Date(startsAt).valueOf();
  const end = new Date(endsAt).valueOf();
  const current = now.valueOf();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return 'cancelled';
  if (current < start) return 'scheduled';
  if (current >= end) return 'completed';
  return 'in_progress';
}

export function issueToMaintenance(issue: { number: number; title: string; body: string | null; html_url: string; state: 'open' | 'closed'; labels: { name: string }[] }, serviceIds: string[], now = new Date()): Maintenance | null {
  const times = parseMaintenanceTimes(issue.body);
  if (!times || !serviceIds.length) return null;
  const cancelled = issue.labels.some((label) => label.name === 'state/cancelled');
  return {
    id: `maintenance-${issue.number}`,
    title: issue.title,
    startsAt: times.startsAt,
    endsAt: times.endsAt,
    timezone: times.timezone,
    serviceIds,
    url: issue.html_url,
    state: cancelled ? 'cancelled' : issue.state === 'closed' ? 'completed' : maintenanceState(times.startsAt, times.endsAt, now),
  };
}
