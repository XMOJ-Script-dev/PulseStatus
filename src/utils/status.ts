import type { Incident, OverallStatus, Service, Severity, Summary } from '../types/status';

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

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}
