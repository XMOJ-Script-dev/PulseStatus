import type { DailyUptime, GroupStatus, Incident, Maintenance, OverallStatus, Service, Severity, Summary, TimelineEntry } from '../types/status';

const severityRank: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };

export const groupStatusRank: Record<GroupStatus, number> = {
  major_outage: 0,
  all_down: 1,
  partial_outage: 2,
  degraded_performance: 3,
  unknown: 4,
  operational: 5,
};

export function groupStatus(members: Service[], activeIncidents: Incident[]): GroupStatus {
  if (members.length === 0) return 'unknown';
  const memberIds = new Set(members.map((member) => member.id));
  const active = activeIncidents.filter((incident) => incident.isActive && incident.serviceIds.some((id) => memberIds.has(id)));
  const effectiveStatus = (member: Service): Service['status'] => {
    const severities = active.filter((incident) => incident.serviceIds.includes(member.id)).map((incident) => incident.severity);
    if (severities.some((severity) => severity !== 'minor')) return 'down';
    if (severities.includes('minor')) return 'degraded';
    return member.status;
  };
  if (active.some((incident) => incident.severity === 'critical')) return 'major_outage';
  if (active.some((incident) => incident.severity === 'major')) return 'partial_outage';
  if (active.some((incident) => incident.severity === 'minor')) return 'degraded_performance';
  const statuses = members.map(effectiveStatus);
  if (statuses.every((status) => status === 'down')) return 'all_down';
  if (statuses.includes('down')) return 'partial_outage';
  if (statuses.includes('degraded')) return 'degraded_performance';
  if (statuses.includes('unknown') || statuses.includes('manually_reported')) return 'unknown';
  return 'operational';
}

export function sortIncidents(incidents: Incident[]): Incident[] {
  return [...incidents].sort((a, b) =>
    severityRank[a.severity] - severityRank[b.severity] ||
    a.state.localeCompare(b.state) ||
    b.updatedAt.localeCompare(a.updatedAt) ||
    a.number - b.number
  );
}

export function mergeTimelineEntries(entries: TimelineEntry[], windowMinutes = 5): TimelineEntry[] {
  const merged: TimelineEntry[] = [];
  const windowMs = windowMinutes * 60 * 1000;
  for (const entry of [...entries].sort((a, b) => a.at.localeCompare(b.at))) {
    const previous = merged.at(-1);
    const closeInTime = previous && Math.abs(Date.parse(entry.at) - Date.parse(previous.at)) <= windowMs;
    const sameState = previous?.state && entry.state && previous.state === entry.state;
    if (closeInTime && sameState) {
      if (entry.type === 'state_change' && !entry.text && previous.type !== 'state_change') continue;
      if (previous.type === 'state_change' && !previous.text && entry.type !== 'state_change') {
        merged.pop();
      }
    }
    merged.push(entry);
  }
  return merged;
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

export function groupMaintenanceByMonth(maintenance: Maintenance[]): Map<string, Maintenance[]> {
  const groups = new Map<string, Maintenance[]>();
  maintenance.filter((item) => item.state === 'completed' || item.state === 'cancelled').forEach((item) => {
    const month = item.startsAt.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), item]);
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

export function buildDailyUptime(
  incidents: Incident[],
  serviceIds: string[],
  generatedAt: string,
  dayCount = 90,
  currentServices: Array<Pick<Service, 'id' | 'status' | 'lastCheckedAt'>> = [],
  maintenance: Maintenance[] = [],
): DailyUptime[] {
  const snapshot = new Date(generatedAt);
  if (Number.isNaN(snapshot.valueOf())) throw new Error(`Invalid uptime snapshot time: ${generatedAt}`);
  if (!Number.isInteger(dayCount) || dayCount < 1) throw new Error(`Invalid uptime day count: ${dayCount}`);

  const maintenanceByService = new Map<string, Array<[number, number]>>();
  for (const serviceId of serviceIds) {
    const windows = maintenance
      .filter((item) => item.state !== 'cancelled' && item.serviceIds.includes(serviceId))
      .map((item) => [new Date(item.startsAt).valueOf(), new Date(item.endsAt).valueOf()] as [number, number])
      .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start);
    maintenanceByService.set(serviceId, mergeIntervals(windows));
  }

  const snapshotDayStart = Date.UTC(snapshot.getUTCFullYear(), snapshot.getUTCMonth(), snapshot.getUTCDate());
  const endOfSnapshotDay = snapshot.valueOf() === snapshotDayStart ? snapshotDayStart : snapshotDayStart + 86_400_000;
  const days: DailyUptime[] = [];
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const start = endOfSnapshotDay - (offset + 1) * 86_400_000;
    const end = Math.min(start + 86_400_000, snapshot.valueOf());
    const date = new Date(start).toISOString().slice(0, 10);
    const services = Object.fromEntries(serviceIds.map((serviceId) => [
      serviceId,
      uptimeForDay(incidents, serviceId, start, end, currentServices, maintenanceByService.get(serviceId) ?? []),
    ]));
    days.push({ date, services });
  }
  return days;
}

function mergeIntervals(intervals: Array<readonly [number, number]>): Array<[number, number]> {
  const merged: Array<[number, number]> = [];
  for (const [start, end] of [...intervals].sort(([a], [b]) => a - b)) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function subtractIntervals(intervals: Array<[number, number]>, exclusions: Array<[number, number]>): number {
  let total = 0;
  for (const [start, end] of intervals) {
    let cursor = start;
    for (const [exclusionStart, exclusionEnd] of exclusions) {
      if (exclusionEnd <= cursor) continue;
      if (exclusionStart >= end) break;
      if (exclusionStart > cursor) total += exclusionStart - cursor;
      cursor = Math.max(cursor, exclusionEnd);
      if (cursor >= end) break;
    }
    if (cursor < end) total += end - cursor;
  }
  return total;
}

function uptimeForDay(
  incidents: Incident[],
  serviceId: string,
  dayStart: number,
  dayEnd: number,
  currentServices: Array<Pick<Service, 'id' | 'status' | 'lastCheckedAt'>>,
  maintenanceIntervals: Array<[number, number]>,
): number {
  const intervals = incidents
    .filter((incident) => incident.serviceIds.includes(serviceId))
    .map((incident) => {
      const start = new Date(incident.startedAt).valueOf();
      const end = new Date(incident.isActive ? dayEnd : incident.closedAt ?? incident.updatedAt).valueOf();
      return [Math.max(start, dayStart), Math.min(end, dayEnd)] as const;
    })
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort(([leftStart], [rightStart]) => leftStart - rightStart);
  const currentService = currentServices.find((service) => service.id === serviceId);
  if (currentService?.status === 'down') {
    const downSince = new Date(currentService.lastCheckedAt ?? '').valueOf();
    if (Number.isFinite(downSince) && downSince < dayEnd) intervals.push([Math.max(downSince, dayStart), dayEnd]);
  }
  intervals.sort(([leftStart], [rightStart]) => leftStart - rightStart);

  const downtime = subtractIntervals(mergeIntervals(intervals), maintenanceIntervals);
  return Math.max(0, Math.min(100, Number((((dayEnd - dayStart - downtime) / (dayEnd - dayStart)) * 100).toFixed(3))));
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}

export function durationParts(startedAt: string, endedAt: string): { days: number; hours: number; minutes: number } | null {
  const start = new Date(startedAt).valueOf();
  const end = new Date(endedAt).valueOf();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  let remaining = Math.round((end - start) / 60_000);
  const days = Math.floor(remaining / 1440);
  remaining -= days * 1440;
  const hours = Math.floor(remaining / 60);
  const minutes = remaining - hours * 60;
  return { days, hours, minutes };
}

function safeMarkdownUrl(value: string): string | null {
  const url = value.trim();
  return /^(?:https?:|mailto:)/i.test(url) ? url : null;
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${renderMarkdownInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) blocks.push(`</${list}>`);
    list = null;
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (code) {
        blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = null;
      } else {
        flushParagraph();
        flushList();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
    } else if (quote) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote>${renderMarkdownInline(quote[1])}</blockquote>`);
    } else if (unordered || ordered) {
      flushParagraph();
      const nextList = unordered ? 'ul' : 'ol';
      if (list !== nextList) {
        flushList();
        list = nextList;
        blocks.push(`<${list}>`);
      }
      blocks.push(`<li>${renderMarkdownInline((unordered ?? ordered)![1])}</li>`);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  if (code) blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  flushParagraph();
  flushList();
  return blocks.join('');
}

function renderMarkdownInline(value: string): string {
  const placeholders: string[] = [];
  const placeholder = (html: string) => {
    const key = `\u0000${placeholders.length}\u0000`;
    placeholders.push(html);
    return key;
  };
  let rendered = escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt: string, rawUrl: string, title?: string) => {
      const url = safeMarkdownUrl(rawUrl);
      return url ? placeholder(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy">`) : escapeHtml(_);
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, rawUrl: string) => {
      const url = safeMarkdownUrl(rawUrl);
      return url ? placeholder(`<a href="${escapeHtml(url)}" rel="noreferrer">${text}</a>`) : text;
    })
    .replace(/`([^`]+)`/g, (_, text: string) => placeholder(`<code>${text}</code>`))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
  return rendered.replace(/\u0000(\d+)\u0000/g, (_, index: string) => placeholders[Number(index)] ?? '');
}
