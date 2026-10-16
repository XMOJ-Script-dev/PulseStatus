import type { DailyUptime, Incident, OverallStatus, Service, Severity, Summary } from '../types/status';

const severityRank: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };

export function sortIncidents(incidents: Incident[]): Incident[] {
  return [...incidents].sort((a, b) =>
    severityRank[a.severity] - severityRank[b.severity] ||
    a.state.localeCompare(b.state) ||
    b.updatedAt.localeCompare(a.updatedAt) ||
    a.number - b.number
  );
}

export function monthForIncident(incident: Incident): string {
  return incident.startedAt.slice(0, 7);
}

export function groupHistoryByMonth(incidents: Incident[]): Map<string, Incident[]> {
  const groups = new Map<string, Incident[]>();
  incidents.filter((incident) => !incident.isActive).forEach((incident) => {
    const month = monthForIncident(incident);
    groups.set(month, [...(groups.get(month) ?? []), incident]);
  });
  return new Map([...groups.entries()].sort(([a], [b]) => b.localeCompare(a)));
}

export function overallStatus(incidents: Incident[], services: Service[]): OverallStatus {
  if (incidents.some((i) => i.isActive && i.severity === 'critical')) return 'major_outage';
  if (incidents.some((i) => i.isActive && i.severity === 'major')) return 'partial_outage';
  if (incidents.some((i) => i.isActive && i.severity === 'minor')) return 'degraded_performance';
  if (services.some((s) => s.status === 'down')) return 'major_outage';
  if (services.some((s) => s.status === 'degraded')) return 'degraded_performance';
  if (services.length === 0 || services.some((s) => s.status === 'unknown')) return 'unknown';
  if (services.some((s) => s.status === 'manually_reported')) return 'monitoring';
  return 'operational';
}

export function buildSummary(incidents: Incident[], services: Service[], generatedAt = new Date().toISOString()): Summary {
  const active = incidents.filter((incident) => incident.isActive);
  return {
    schemaVersion: 1,
    generatedAt,
    overall: overallStatus(active, services),
    hasActiveIncident: active.length > 0,
    activeIncidentCount: active.length,
    affectedServiceCount: new Set(active.flatMap((incident) => incident.serviceIds)).size,
    activeMaintenanceCount: 0,
    monitoringMode: 'manual',
    isDemo: false,
  };
}

export function buildDailyUptime(incidents: Incident[], serviceIds: string[], generatedAt: string, dayCount = 90): DailyUptime[] {
  const snapshot = new Date(generatedAt);
  if (Number.isNaN(snapshot.valueOf())) throw new Error(`Invalid uptime snapshot time: ${generatedAt}`);
  if (!Number.isInteger(dayCount) || dayCount < 1) throw new Error(`Invalid uptime day count: ${dayCount}`);

  const snapshotDayStart = Date.UTC(snapshot.getUTCFullYear(), snapshot.getUTCMonth(), snapshot.getUTCDate());
  const endOfSnapshotDay = snapshot.valueOf() === snapshotDayStart ? snapshotDayStart : snapshotDayStart + 86_400_000;
  const days: DailyUptime[] = [];
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const start = endOfSnapshotDay - (offset + 1) * 86_400_000;
    const end = Math.min(start + 86_400_000, snapshot.valueOf());
    const date = new Date(start).toISOString().slice(0, 10);
    const services = Object.fromEntries(serviceIds.map((serviceId) => [
      serviceId,
      uptimeForDay(incidents, serviceId, start, end),
    ]));
    days.push({ date, services });
  }
  return days;
}

function uptimeForDay(incidents: Incident[], serviceId: string, dayStart: number, dayEnd: number): number {
  const intervals = incidents
    .filter((incident) => incident.serviceIds.includes(serviceId))
    .map((incident) => {
      const start = new Date(incident.startedAt).valueOf();
      const end = new Date(incident.isActive ? dayEnd : incident.closedAt ?? incident.updatedAt).valueOf();
      return [Math.max(start, dayStart), Math.min(end, dayEnd)] as const;
    })
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort(([leftStart], [rightStart]) => leftStart - rightStart);

  let downtime = 0;
  let intervalEnd = -Infinity;
  for (const [start, end] of intervals) {
    if (end <= intervalEnd) continue;
    downtime += end - Math.max(start, intervalEnd);
    intervalEnd = end;
  }
  return Math.max(0, Math.min(100, Number((((dayEnd - dayStart - downtime) / (dayEnd - dayStart)) * 100).toFixed(3))));
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}
