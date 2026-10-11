import type { Maintenance } from '../types/status';

export function parseMaintenanceTimes(body: string | null): { startsAt: string; endsAt: string; timezone: string } | null {
  const text = body ?? '';
  const startsAt = text.match(/(?:Start|Starts at)\s*:\s*(\S+)/i)?.[1];
  const endsAt = text.match(/(?:End|Ends at)\s*:\s*(\S+)/i)?.[1];
  const timezone = text.match(/Timezone\s*:\s*([A-Za-z0-9_./+-]+)/i)?.[1] ?? 'UTC';
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
