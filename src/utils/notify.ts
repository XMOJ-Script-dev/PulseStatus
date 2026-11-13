import type { Incident } from '../types/status';

export type NotifyEvent = 'opened' | 'resolved';

const COLORS = { minor: 15105570, major: 15548997, critical: 10038562, opened: 15548997, resolved: 3066993 } as const;

export function incidentEventTitle(incident: Incident, event: NotifyEvent): string {
  return event === 'opened' ? `🟠 Incident opened: ${incident.title}` : `🟢 Incident resolved: ${incident.title}`;
}

export function incidentEventDescription(incident: Incident, event: NotifyEvent, services: Array<{ id: string; name: string }>): string {
  const names = incident.serviceIds.map((id) => services.find((service) => service.id === id)?.name ?? id).join(', ');
  const status = event === 'opened' ? `State: ${incident.state} · Severity: ${incident.severity}` : `Resolved after ${incident.startedAt}`;
  return `${incident.bodySummary}\nAffected: ${names}\n${status}\n${incident.url}`;
}

export function buildDiscordPayload(incident: Incident, event: NotifyEvent, siteName: string, services: Array<{ id: string; name: string }>): Record<string, unknown> {
  return {
    username: siteName,
    embeds: [{
      title: incidentEventTitle(incident, event),
      description: incidentEventDescription(incident, event, services),
      url: incident.url,
      color: event === 'resolved' ? COLORS.resolved : (COLORS[incident.severity] ?? COLORS.opened),
      timestamp: incident.updatedAt,
    }],
  };
}

export function buildSlackPayload(incident: Incident, event: NotifyEvent, siteName: string, services: Array<{ id: string; name: string }>): Record<string, unknown> {
  const color = event === 'resolved' ? '#16a34a' : incident.severity === 'critical' ? '#b91c1c' : incident.severity === 'major' ? '#ef4444' : '#d97706';
  return {
    username: siteName,
    attachments: [{
      color,
      title: incidentEventTitle(incident, event),
      title_link: incident.url,
      text: incidentEventDescription(incident, event, services),
      footer: siteName,
      ts: Math.floor(new Date(incident.updatedAt).valueOf() / 1000) || undefined,
    }],
  };
}

export function buildNtfyPayload(incident: Incident, event: NotifyEvent, siteName: string, services: Array<{ id: string; name: string }>): { title: string; body: string; priority: number; tags: string; click: string } {
  return {
    title: incidentEventTitle(incident, event).slice(0, 250),
    body: incidentEventDescription(incident, event, services).slice(0, 4000),
    priority: incident.severity === 'critical' ? 5 : incident.severity === 'major' ? 4 : 3,
    tags: event === 'resolved' ? 'white_check_mark' : 'rotating_light',
    click: incident.url,
  };
}
