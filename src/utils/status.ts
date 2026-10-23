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

export function buildDailyUptime(
  incidents: Incident[],
  serviceIds: string[],
  generatedAt: string,
  dayCount = 90,
  currentServices: Array<Pick<Service, 'id' | 'status' | 'lastCheckedAt'>> = [],
): DailyUptime[] {
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
      uptimeForDay(incidents, serviceId, start, end, currentServices),
    ]));
    days.push({ date, services });
  }
  return days;
}

function uptimeForDay(
  incidents: Incident[],
  serviceId: string,
  dayStart: number,
  dayEnd: number,
  currentServices: Array<Pick<Service, 'id' | 'status' | 'lastCheckedAt'>>,
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
